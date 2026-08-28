// Pin pop animation for the Leaflet WebView map.
// Markers are DOM nodes inside the WebView, so this cannot use Reanimated.
// Dim opacity must live on inner pin nodes. MapLibre writes marker-root
// opacity back to 1 on every move/moveend via Marker._updateOpacity.

export const PIN_SCALE_NORMAL = 1;
export const PIN_SCALE_PEAK = 1.22;
export const PIN_SCALE_SELECTED = 1.12;
export const PIN_SCALE_DIMMED = 0.88;
export const PIN_OPACITY_NORMAL = 1;
export const PIN_OPACITY_DIMMED = 0.42;
export const PIN_POP_DURATION_MS = 220;
export const PIN_UNSELECT_DURATION_MS = 180;
export const PIN_POP_PEAK_AT = 0.45;

export const CAMPUS_MAP_PIN_CSS = `
      .skateu-pin {
        background: none;
        border: none;
        overflow: visible;
        width: 50px;
        height: 50px;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
      }
      .skateu-pin-shadow {
        position: absolute;
        left: 12px;
        top: 9px;
        width: 41px;
        height: 41px;
        pointer-events: none;
        -webkit-touch-callout: none;
        -webkit-user-drag: none;
      }
      .skateu-pin-scale {
        display: block;
        width: 50px;
        height: 50px;
        transform-origin: 50% 100%;
        will-change: transform, opacity;
        pointer-events: none;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
      }
      .skateu-pin-img {
        display: block;
        width: 50px;
        height: 50px;
        pointer-events: none;
        -webkit-touch-callout: none;
        -webkit-user-drag: none;
        -webkit-user-select: none;
        user-select: none;
      }
`;

export function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - (1 - clamped) ** 3;
}

export function samplePinKeyframes(
  frames: readonly { t: number; value: number }[],
  progress: number,
  fallback: number
): number {
  const p = Math.max(0, Math.min(1, progress));
  if (frames.length === 0) {
    return fallback;
  }

  for (let i = 1; i < frames.length; i += 1) {
    const next = frames[i];
    if (p <= next.t) {
      const prev = frames[i - 1];
      const span = next.t - prev.t;
      const local = span <= 0 ? 1 : (p - prev.t) / span;
      return prev.value + (next.value - prev.value) * easeOutCubic(local);
    }
  }

  return frames[frames.length - 1]?.value ?? fallback;
}

export function samplePinScaleFrames(
  frames: readonly { t: number; scale: number }[],
  progress: number
): number {
  return samplePinKeyframes(
    frames.map((frame) => ({ t: frame.t, value: frame.scale })),
    progress,
    PIN_SCALE_NORMAL
  );
}

export function getCampusMapPinScript(): string {
  return `
        (function () {
          var PIN_SCALE_NORMAL = ${PIN_SCALE_NORMAL};
          var PIN_SCALE_PEAK = ${PIN_SCALE_PEAK};
          var PIN_SCALE_SELECTED = ${PIN_SCALE_SELECTED};
          var PIN_SCALE_DIMMED = ${PIN_SCALE_DIMMED};
          var PIN_OPACITY_NORMAL = ${PIN_OPACITY_NORMAL};
          var PIN_OPACITY_DIMMED = ${PIN_OPACITY_DIMMED};
          var PIN_POP_DURATION_MS = ${PIN_POP_DURATION_MS};
          var PIN_UNSELECT_DURATION_MS = ${PIN_UNSELECT_DURATION_MS};
          var PIN_POP_PEAK_AT = ${PIN_POP_PEAK_AT};

          window.selectedSpotId = window.selectedSpotId || null;

          function easeOutCubic(t) {
            var clamped = t < 0 ? 0 : t > 1 ? 1 : t;
            return 1 - Math.pow(1 - clamped, 3);
          }

          function samplePinKeyframes(frames, progress, key, fallback) {
            var p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
            var i;
            if (!frames || frames.length === 0) {
              return fallback;
            }
            for (i = 1; i < frames.length; i += 1) {
              var next = frames[i];
              if (p <= next.t) {
                var prev = frames[i - 1];
                var span = next.t - prev.t;
                var local = span <= 0 ? 1 : (p - prev.t) / span;
                return prev[key] + (next[key] - prev[key]) * easeOutCubic(local);
              }
            }
            return frames[frames.length - 1][key];
          }

          function cancelPinAnimation(el) {
            if (!el || !el._skateuPinAnim) return;
            cancelAnimationFrame(el._skateuPinAnim.raf);
            el._skateuPinAnim = null;
          }

          function getPinScale(el) {
            if (!el) return PIN_SCALE_NORMAL;
            var match = String(el.style.transform || '').match(/scale\\(([^)]+)\\)/);
            if (match) {
              var parsed = parseFloat(match[1]);
              if (Number.isFinite(parsed)) return parsed;
            }
            return PIN_SCALE_NORMAL;
          }

          function getPinOpacity(el) {
            if (!el) return PIN_OPACITY_NORMAL;
            var parsed = parseFloat(el.style.opacity);
            if (Number.isFinite(parsed)) return parsed;
            return PIN_OPACITY_NORMAL;
          }

          function setPinScale(el, scale) {
            el.style.transform = 'scale(' + scale + ')';
          }

          function setPinOpacity(el, root, opacity) {
            if (el && el.style) {
              el.style.opacity = String(opacity);
            }
            var shadow = root && root.querySelector ? root.querySelector('.skateu-pin-shadow') : null;
            if (shadow && shadow.style) {
              shadow.style.opacity = String(opacity);
            }
          }

          function animatePinVisual(el, root, scaleFrames, opacityFrames, duration) {
            cancelPinAnimation(el);
            var start = performance.now();
            scaleFrames = scaleFrames.slice();
            opacityFrames = opacityFrames.slice();
            scaleFrames[0] = { t: 0, scale: getPinScale(el) };
            opacityFrames[0] = { t: 0, opacity: getPinOpacity(el) };

            function tick(now) {
              var p = (now - start) / duration;
              if (p >= 1) {
                setPinScale(el, scaleFrames[scaleFrames.length - 1].scale);
                setPinOpacity(el, root, opacityFrames[opacityFrames.length - 1].opacity);
                el._skateuPinAnim = null;
                return;
              }
              setPinScale(el, samplePinKeyframes(scaleFrames, p, 'scale', PIN_SCALE_NORMAL));
              setPinOpacity(el, root, samplePinKeyframes(opacityFrames, p, 'opacity', PIN_OPACITY_NORMAL));
              el._skateuPinAnim = { raf: requestAnimationFrame(tick) };
            }

            el._skateuPinAnim = { raf: requestAnimationFrame(tick) };
          }

          function getMarkerRoot(marker) {
            if (!marker) return null;
            if (typeof marker.getElement === 'function') {
              return marker.getElement();
            }
            return marker._icon || null;
          }

          function getMarkerIcon(marker) {
            var root = getMarkerRoot(marker);
            if (!root) return null;
            return root.querySelector('.skateu-pin-scale') || root;
          }

          function setMarkerRaised(marker, raised) {
            if (!marker) return;
            if (typeof marker.setZIndexOffset === 'function') {
              marker.setZIndexOffset(raised ? 1000 : 0);
            }
            var root = getMarkerRoot(marker);
            if (root && root.style) {
              root.style.zIndex = raised ? '1000' : '0';
            }
          }

          function snapMarkerVisual(el, root, scale, opacity) {
            cancelPinAnimation(el);
            setPinScale(el, scale);
            setPinOpacity(el, root, opacity);
          }

          function dimMarker(id, animate) {
            var marker = window.markers && window.markers[id];
            if (!marker) return;
            setMarkerRaised(marker, false);
            var root = getMarkerRoot(marker);
            var el = getMarkerIcon(marker);
            if (!el || !root) return;
            if (!animate) {
              snapMarkerVisual(el, root, PIN_SCALE_DIMMED, PIN_OPACITY_DIMMED);
              return;
            }
            animatePinVisual(el, root, [
              { t: 0, scale: getPinScale(el) },
              { t: 1, scale: PIN_SCALE_DIMMED }
            ], [
              { t: 0, opacity: getPinOpacity(el) },
              { t: 1, opacity: PIN_OPACITY_DIMMED }
            ], PIN_UNSELECT_DURATION_MS);
          }

          function restoreMarker(id, animate) {
            var marker = window.markers && window.markers[id];
            if (!marker) return;
            setMarkerRaised(marker, false);
            var root = getMarkerRoot(marker);
            var el = getMarkerIcon(marker);
            if (!el || !root) return;
            if (!animate) {
              snapMarkerVisual(el, root, PIN_SCALE_NORMAL, PIN_OPACITY_NORMAL);
              return;
            }
            animatePinVisual(el, root, [
              { t: 0, scale: getPinScale(el) },
              { t: 1, scale: PIN_SCALE_NORMAL }
            ], [
              { t: 0, opacity: getPinOpacity(el) },
              { t: 1, opacity: PIN_OPACITY_NORMAL }
            ], PIN_UNSELECT_DURATION_MS);
          }

          function selectMarker(id, pop) {
            var marker = window.markers && window.markers[id];
            if (!marker) return;
            setMarkerRaised(marker, true);
            var root = getMarkerRoot(marker);
            var el = getMarkerIcon(marker);
            if (!el || !root) return;
            if (!pop) {
              snapMarkerVisual(el, root, PIN_SCALE_SELECTED, PIN_OPACITY_NORMAL);
              return;
            }
            animatePinVisual(el, root, [
              { t: 0, scale: getPinScale(el) },
              { t: PIN_POP_PEAK_AT, scale: PIN_SCALE_PEAK },
              { t: 1, scale: PIN_SCALE_SELECTED }
            ], [
              { t: 0, opacity: getPinOpacity(el) },
              { t: 1, opacity: PIN_OPACITY_NORMAL }
            ], PIN_POP_DURATION_MS);
          }

          window.selectSpot = function (id, options) {
            var nextId = id == null || id === '' ? null : String(id);
            var pop = !options || options.pop !== false;
            var previousId = window.selectedSpotId || null;
            var sameSelection = previousId === nextId;

            if (sameSelection && !nextId) {
              return;
            }

            window.selectedSpotId = nextId;
            var markerIds = Object.keys(window.markers || {});
            var animate = !sameSelection && pop;

            markerIds.forEach(function (markerId) {
              if (nextId && markerId === nextId) {
                selectMarker(markerId, animate);
                return;
              }
              if (nextId) {
                dimMarker(markerId, animate);
                return;
              }
              restoreMarker(markerId, true);
            });
          };

          window.resetPinAnimations = function () {
            if (!window.markers) return;
            Object.keys(window.markers).forEach(function (id) {
              var el = getMarkerIcon(window.markers[id]);
              if (el) cancelPinAnimation(el);
            });
          };
        })();
`;
}

export function buildSelectSpotJavascript(spotId: string | undefined): string {
  const arg = spotId == null ? 'null' : JSON.stringify(spotId);
  return `if (window.selectSpot) { window.selectSpot(${arg}); } true;`;
}
