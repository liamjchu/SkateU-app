export const CAMPUS_USER_LOCATION_ZOOM = 17;

export function getLeafletUserLocationScript(): string {
  return `
        (function () {
          var userLatLng = null;
          var userAccuracy = 0;
          var layersReady = false;

          function emptyCollection() {
            return { type: 'FeatureCollection', features: [] };
          }

          function metersToPixels(meters, lat) {
            if (!window.map || !isFinite(meters) || meters <= 0) return 0;
            var zoom = window.map.getZoom();
            var metersPerPixel =
              (156543.03392 * Math.cos((lat * Math.PI) / 180)) /
              Math.pow(2, zoom);
            if (!isFinite(metersPerPixel) || metersPerPixel <= 0) return 0;
            return meters / metersPerPixel;
          }

          function renderUserLocation() {
            if (!layersReady || !window.map || !window.map.getSource('user-location')) {
              return;
            }
            if (!userLatLng) {
              window.map.getSource('user-location').setData(emptyCollection());
              return;
            }

            var features = [
              {
                type: 'Feature',
                properties: { kind: 'dot' },
                geometry: {
                  type: 'Point',
                  coordinates: [userLatLng.lng, userLatLng.lat],
                },
              },
            ];
            if (userAccuracy > 0) {
              features.unshift({
                type: 'Feature',
                properties: {
                  kind: 'accuracy',
                  radiusPx: metersToPixels(userAccuracy, userLatLng.lat),
                },
                geometry: {
                  type: 'Point',
                  coordinates: [userLatLng.lng, userLatLng.lat],
                },
              });
            }
            window.map.getSource('user-location').setData({
              type: 'FeatureCollection',
              features: features,
            });
          }

          function setupUserLocationLayers() {
            if (!window.map || window.map.getSource('user-location')) {
              layersReady = !!window.map && !!window.map.getSource('user-location');
              renderUserLocation();
              return;
            }
            window.map.addSource('user-location', {
              type: 'geojson',
              data: emptyCollection(),
            });
            window.map.addLayer({
              id: 'user-accuracy',
              type: 'circle',
              source: 'user-location',
              filter: ['==', ['get', 'kind'], 'accuracy'],
              paint: {
                'circle-radius': ['coalesce', ['get', 'radiusPx'], 0],
                'circle-color': '#1A73E8',
                'circle-opacity': 0.16,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#1A73E8',
                'circle-stroke-opacity': 0.35,
              },
            });
            window.map.addLayer({
              id: 'user-dot',
              type: 'circle',
              source: 'user-location',
              filter: ['==', ['get', 'kind'], 'dot'],
              paint: {
                'circle-radius': 8,
                'circle-color': '#1A73E8',
                'circle-opacity': 1,
                'circle-stroke-width': 3,
                'circle-stroke-color': '#FFFFFF',
              },
            });
            layersReady = true;
            window.map.on('zoom', renderUserLocation);
            renderUserLocation();
          }

          window.setUserLocation = function (lat, lng, accuracy) {
            var nextLat = Number(lat);
            var nextLng = Number(lng);
            if (!isFinite(nextLat) || !isFinite(nextLng)) return;
            userLatLng = { lat: nextLat, lng: nextLng };
            var radius = Number(accuracy);
            userAccuracy = isFinite(radius) && radius > 0 ? radius : 0;
            renderUserLocation();
          };

          window.clearUserLocation = function () {
            userLatLng = null;
            userAccuracy = 0;
            renderUserLocation();
          };

          window.goToUserLocation = function (zoom) {
            if (!window.map || !userLatLng) return;
            var nextZoom =
              typeof zoom === 'number' && isFinite(zoom)
                ? zoom
                : window.map.getZoom();
            window.map.easeTo({
              center: [userLatLng.lng, userLatLng.lat],
              zoom: nextZoom,
            });
          };

          if (window.onMapReady) {
            window.onMapReady(setupUserLocationLayers);
          } else if (window.map) {
            window.map.once('load', setupUserLocationLayers);
          }
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
