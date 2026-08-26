export const CAMPUS_USER_LOCATION_ZOOM = 17;

export function getLeafletUserLocationScript(): string {
  return `
        (function () {
          var userAccuracyCircle = null;
          var userDot = null;
          var userLatLng = null;

          window.setUserLocation = function (lat, lng, accuracy) {
            if (!window.map) return;
            var nextLat = Number(lat);
            var nextLng = Number(lng);
            if (!isFinite(nextLat) || !isFinite(nextLng)) return;
            userLatLng = L.latLng(nextLat, nextLng);
            var radius = Number(accuracy);
            if (!isFinite(radius) || radius < 0) radius = 0;

            if (radius > 0) {
              if (userAccuracyCircle) {
                userAccuracyCircle.setLatLng(userLatLng);
                userAccuracyCircle.setRadius(radius);
              } else {
                userAccuracyCircle = L.circle(userLatLng, {
                  radius: radius,
                  interactive: false,
                  fillColor: '#1A73E8',
                  fillOpacity: 0.16,
                  color: '#1A73E8',
                  weight: 1,
                  opacity: 0.35,
                }).addTo(window.map);
              }
            } else if (userAccuracyCircle) {
              window.map.removeLayer(userAccuracyCircle);
              userAccuracyCircle = null;
            }

            if (userDot) {
              userDot.setLatLng(userLatLng);
            } else {
              userDot = L.circleMarker(userLatLng, {
                interactive: false,
                radius: 8,
                fillColor: '#1A73E8',
                fillOpacity: 1,
                color: '#FFFFFF',
                weight: 3,
              }).addTo(window.map);
            }
          };

          window.clearUserLocation = function () {
            if (!window.map) {
              userAccuracyCircle = null;
              userDot = null;
              userLatLng = null;
              return;
            }
            if (userAccuracyCircle) {
              window.map.removeLayer(userAccuracyCircle);
              userAccuracyCircle = null;
            }
            if (userDot) {
              window.map.removeLayer(userDot);
              userDot = null;
            }
            userLatLng = null;
          };

          window.goToUserLocation = function (zoom) {
            if (!window.map || !userLatLng) return;
            var nextZoom = typeof zoom === 'number' && isFinite(zoom)
              ? zoom
              : window.map.getZoom();
            window.map.setView(userLatLng, nextZoom, { animate: true });
          };
        })();
`;
}

export function buildSetUserLocationJavascript(
  latitude: number,
  longitude: number,
  accuracy: number | null
): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return 'true;';
  }

  const radius =
    accuracy != null && Number.isFinite(accuracy) && accuracy > 0
      ? accuracy
      : 0;

  return `window.setUserLocation(${latitude},${longitude},${radius}); true;`;
}

export const CLEAR_USER_LOCATION_JAVASCRIPT =
  'if (window.clearUserLocation) { window.clearUserLocation(); } true;';

export function buildGoToUserLocationJavascript(zoom?: number): string {
  if (zoom != null && Number.isFinite(zoom)) {
    return `if (window.goToUserLocation) { window.goToUserLocation(${zoom}); } true;`;
  }

  return 'if (window.goToUserLocation) { window.goToUserLocation(); } true;';
}
