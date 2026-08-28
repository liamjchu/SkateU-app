// Pin pop animation for the Leaflet WebView map.
// Markers are DOM nodes inside the WebView, so this cannot use Reanimated.

export const PIN_SCALE_NORMAL = 1;
export const PIN_SCALE_PEAK = 1.22;
export const PIN_SCALE_SELECTED = 1.12;
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
        will-change: transform;
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

export function samplePinScaleFrames(
  frames: readonly { t: number; scale: number }[],
  progress: number
): number {
  const p = Math.max(0, Math.min(1, progress));
  if (frames.length === 0) {
    return PIN_SCALE_NORMAL;
  }

  for (let i = 1; i < frames.length; i += 1) {
    const next = frames[i];
    if (p <= next.t) {
      const prev = frames[i - 1];
      const span = next.t - prev.t;
      const local = span <= 0 ? 1 : (p - prev.t) / span;
      return prev.scale + (next.scale - prev.scale) * easeOutCubic(local);
    }
  }

  return frames[frames.length - 1]?.scale ?? PIN_SCALE_NORMAL;
}

export function getCampusMapPinScript(): string {
  return `
        (function () {
          var PIN_SCALE_NORMAL = ${PIN_SCALE_NORMAL};
          var PIN_SCALE_PEAK = ${PIN_SCALE_PEAK};
          var PIN_SCALE_SELECTED = ${PIN_SCALE_SELECTED};
          var PIN_POP_DURATION_MS = ${PIN_POP_DURATION_MS};
          var PIN_UNSELECT_DURATION_MS = ${PIN_UNSELECT_DURATION_MS};
          var PIN_POP_PEAK_AT = ${PIN_POP_PEAK_AT};

          window.selectedSpotId = window.selectedSpotId || null;

          function easeOutCubic(t) {
            var clamped = t < 0 ? 0 : t > 1 ? 1 : t;
            return 1 - Math.pow(1 - clamped, 3);
          }

          function samplePinScaleFrames(frames, progress) {
            var p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
            var i;
            for (i = 1; i < frames.length; i += 1) {
              var next = frames[i];
              if (p <= next.t) {
                var prev = frames[i - 1];
                var span = next.t - prev.t;
                var local = span <= 0 ? 1 : (p - prev.t) / span;
                return prev.scale + (next.scale - prev.scale) * easeOutCubic(local);
              }
            }
            return frames[frames.length - 1].scale;
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

          function setPinScale(el, scale) {
            el.style.transform = 'scale(' + scale + ')';
          }

          function animatePinScale(el, frames, duration) {
            cancelPinAnimation(el);
            var start = performance.now();
            frames = frames.slice();
            frames[0] = { t: 0, scale: getPinScale(el) };

            function tick(now) {
              var p = (now - start) / duration;
              if (p >= 1) {
                setPinScale(el, frames[frames.length - 1].scale);
                el._skateuPinAnim = null;
                return;
              }
              setPinScale(el, samplePinScaleFrames(frames, p));
              el._skateuPinAnim = { raf: requestAnimationFrame(tick) };
            }

            el._skateuPinAnim = { raf: requestAnimationFrame(tick) };
          }

          function getMarkerIcon(marker) {
            if (!marker) return null;
            var root = typeof marker.getElement === 'function'
              ? marker.getElement()
              : marker._icon;
            if (!root) return null;
            return root.querySelector('.skateu-pin-scale') || root;
          }

          function setMarkerRaised(marker, raised) {
            if (!marker) return;
            if (typeof marker.setZIndexOffset === 'function') {
              marker.setZIndexOffset(raised ? 1000 : 0);
            }
            var root = typeof marker.getElement === 'function'
              ? marker.getElement()
              : null;
            if (root && root.style) {
              root.style.zIndex = raised ? '1000' : '0';
            }
          }

          function unselectMarker(id) {
            var marker = window.markers && window.markers[id];
            if (!marker) return;
            setMarkerRaised(marker, false);
            var el = getMarkerIcon(marker);
            if (!el) return;
            animatePinScale(el, [
              { t: 0, scale: getPinScale(el) },
              { t: 1, scale: PIN_SCALE_NORMAL }
            ], PIN_UNSELECT_DURATION_MS);
          }

          function selectMarker(id, pop) {
            var marker = window.markers && window.markers[id];
            if (!marker) return;
            setMarkerRaised(marker, true);
            var el = getMarkerIcon(marker);
            if (!el) return;
            if (!pop) {
              cancelPinAnimation(el);
              setPinScale(el, PIN_SCALE_SELECTED);
              return;
            }
            animatePinScale(el, [
              { t: 0, scale: getPinScale(el) },
              { t: PIN_POP_PEAK_AT, scale: PIN_SCALE_PEAK },
              { t: 1, scale: PIN_SCALE_SELECTED }
            ], PIN_POP_DURATION_MS);
          }

          window.selectSpot = function (id, options) {
            var nextId = id == null || id === '' ? null : String(id);
            var pop = !options || options.pop !== false;
            var previousId = window.selectedSpotId || null;

            if (previousId === nextId) {
              if (nextId) {
                selectMarker(nextId, false);
              }
              return;
            }

            window.selectedSpotId = nextId;

            if (previousId) {
              unselectMarker(previousId);
            }
            if (nextId) {
              selectMarker(nextId, pop);
            }
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
