export const MAPLIBRE_CSS_URL =
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
export const MAPLIBRE_JS_URL =
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
export const OPENFREEMAP_STYLE_URL =
  'https://tiles.openfreemap.org/styles/liberty';
export const ESRI_SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const STREET_MAX_ZOOM = 20;
export const SATELLITE_MAX_ZOOM = 19;
export const DEFAULT_MAP_ZOOM = 15.5;

export type OpenFreeMapLayer = 'default' | 'satellite';

type CreateMapLibreMapOptions = {
  latitude: number;
  longitude: number;
  layer: OpenFreeMapLayer;
  zoom?: number;
};

export function getMapLibreHeadTags(): string {
  return `
    <link rel="stylesheet" href="${MAPLIBRE_CSS_URL}" />
    <script src="${MAPLIBRE_JS_URL}"></script>`;
}

export function getMapLibreBaseCss(): string {
  return `
    .maplibregl-ctrl-attrib { display: none; }
    .maplibregl-canvas { outline: none; }
    .maplibregl-marker { background: none; border: none; }
    #map:not(.satellite) .maplibregl-canvas { filter: brightness(.9); }
    #map.satellite .maplibregl-canvas { filter: brightness(.8); }`;
}

export function getCreateMapLibreMapScript({
  latitude,
  longitude,
  layer,
  zoom = DEFAULT_MAP_ZOOM,
}: CreateMapLibreMapOptions): string {
  return `
        window.postToNative = window.postToNative || function (message) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
          }
        };

        var mapElement = document.getElementById('map');
        window.currentLayer = '${layer}' === 'satellite' ? 'satellite' : 'default';
        if (mapElement) {
          mapElement.classList.toggle('satellite', window.currentLayer === 'satellite');
        }

        window.map = new maplibregl.Map({
          container: 'map',
          style: '${OPENFREEMAP_STYLE_URL}',
          center: [${longitude}, ${latitude}],
          zoom: ${zoom},
          minZoom: 2,
          maxZoom: ${STREET_MAX_ZOOM},
          pitch: 0,
          maxPitch: 0,
          attributionControl: false,
          dragRotate: true,
          pitchWithRotate: false,
          touchPitch: false,
        });

        window.map.on('error', function () {
          window.postToNative({
            type: 'TILE_ERROR',
            message: 'Map tiles could not be loaded.',
          });
        });

        window.onMapReady = function (fn) {
          if (!window.map || typeof fn !== 'function') return;
          if (window.map.loaded && window.map.loaded()) {
            fn();
            return;
          }
          window.map.once('load', fn);
        };

        window.ensureSatelliteOverlay = function () {
          if (!window.map || window.map.getSource('satellite')) return;
          window.map.addSource('satellite', {
            type: 'raster',
            tiles: ['${ESRI_SATELLITE_TILE_URL}'],
            tileSize: 256,
            maxzoom: ${SATELLITE_MAX_ZOOM},
          });
          window.map.addLayer({
            id: 'satellite',
            type: 'raster',
            source: 'satellite',
            layout: {
              visibility: window.currentLayer === 'satellite' ? 'visible' : 'none',
            },
          });
        };

        window.setMapLayer = function (selectedLayerName) {
          if (
            !window.map ||
            (selectedLayerName !== 'default' && selectedLayerName !== 'satellite')
          ) {
            return;
          }

          window.currentLayer = selectedLayerName;
          if (mapElement) {
            mapElement.classList.toggle('satellite', selectedLayerName === 'satellite');
          }
          if (window.map.getSource && window.map.getSource('satellite')) {
            window.map.setLayoutProperty(
              'satellite',
              'visibility',
              selectedLayerName === 'satellite' ? 'visible' : 'none'
            );
          }

          var layerToggleButton = document.getElementById('layer-toggle');
          if (layerToggleButton) {
            var isSatellite = selectedLayerName === 'satellite';
            layerToggleButton.setAttribute('aria-pressed', String(isSatellite));
            layerToggleButton.setAttribute(
              'aria-label',
              isSatellite
                ? 'Switch location map to standard map'
                : 'Switch location map to satellite map'
            );
          }

          window.postToNative({
            type: 'LAYER_TOGGLED',
            layer: selectedLayerName,
          });
        };

        window.toggleLayer = function () {
          window.setMapLayer(
            window.currentLayer === 'default' ? 'satellite' : 'default'
          );
        };

        window.currentBearing = function () {
          if (!window.map || typeof window.map.getBearing !== 'function') return 0;
          var bearing = window.map.getBearing();
          if (!isFinite(bearing)) return 0;
          return ((bearing % 360) + 360) % 360;
        };

        window.resetMapNorth = function () {
          if (!window.map || typeof window.map.easeTo !== 'function') return;
          window.map.easeTo({ bearing: 0, pitch: 0 });
        };

        var bearingFrame = null;
        window.postMapBearing = function () {
          window.postToNative({
            type: 'BEARING_CHANGED',
            bearing: window.currentBearing(),
          });
        };
        window.scheduleMapBearingPost = function () {
          if (bearingFrame) return;
          bearingFrame = requestAnimationFrame(function () {
            bearingFrame = null;
            window.postMapBearing();
          });
        };

        window.map.on('rotate', window.scheduleMapBearingPost);
        window.map.on('rotateend', function () {
          if (bearingFrame) {
            cancelAnimationFrame(bearingFrame);
            bearingFrame = null;
          }
          window.postMapBearing();
        });

        window.onMapReady(function () {
          window.ensureSatelliteOverlay();
          window.postMapBearing();
        });
`;
}
