export type LocationMapLayer = 'default' | 'satellite';

type LocationMapHtmlOptions = {
  latitude: number;
  longitude: number;
  layer: LocationMapLayer;
};

export function buildLocationPickerHtml({
  latitude,
  longitude,
  layer,
}: LocationMapHtmlOptions): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #0b0f14;
    }
    #map { height: 100%; width: 100%; }
    .leaflet-control-attribution { display: none; }
    #map:not(.satellite) .leaflet-tile { filter: brightness(.9); }
    #map.satellite .leaflet-tile { filter: brightness(.8); }
    #layer-toggle {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 1000;
      display: flex;
      width: 40px;
      height: 40px;
      padding: 0;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 9999px;
      background: #21473f;
      box-shadow: 0 4px 10px rgba(0, 0, 0, .3);
      color: #fff;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    #layer-toggle:active { opacity: .88; transform: scale(.98); }
    #layer-toggle svg { width: 25px; height: 25px; pointer-events: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <button id="layer-toggle" type="button" aria-pressed="false" aria-label="Switch location map to satellite map">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      <path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
  <script id="location-map-script">
    (function () {
      function postMessage(message) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      }

      window.onerror = function (message, source, lineno) {
        postMessage({
          type: 'CONSOLE_ERROR',
          message: String(message) + ' at line ' + lineno,
        });
        return true;
      };

      try {
        const center = [${latitude}, ${longitude}];
        const mapElement = document.getElementById('map');
        const layerToggleButton = document.getElementById('layer-toggle');

        window.map = L.map('map', {
          zoomControl: false,
          attributionControl: false,
        }).setView(center, 15.5);

        const defaultLayer = L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        );
        const satelliteLayer = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png'
        );

        function syncLayerControl(selectedLayer) {
          const isSatellite = selectedLayer === 'satellite';
          mapElement.classList.toggle('satellite', isSatellite);
          layerToggleButton.setAttribute('aria-pressed', String(isSatellite));
          layerToggleButton.setAttribute(
            'aria-label',
            isSatellite
              ? 'Switch location map to standard map'
              : 'Switch location map to satellite map'
          );
        }

        const selectedLayer = '${layer}' === 'satellite'
          ? satelliteLayer
          : defaultLayer;
        window.currentLayer = selectedLayer.addTo(window.map);
        syncLayerControl('${layer}');

        window.setMapLayer = function (selectedLayerName) {
          if (
            !window.map ||
            (selectedLayerName !== 'default' && selectedLayerName !== 'satellite')
          ) {
            return;
          }

          if (
            selectedLayerName === 'satellite' &&
            window.currentLayer !== satelliteLayer
          ) {
            window.map.removeLayer(window.currentLayer);
            window.currentLayer = satelliteLayer.addTo(window.map);
          } else if (
            selectedLayerName === 'default' &&
            window.currentLayer !== defaultLayer
          ) {
            window.map.removeLayer(window.currentLayer);
            window.currentLayer = defaultLayer.addTo(window.map);
          }

          const activeLayer = window.currentLayer === satelliteLayer
            ? 'satellite'
            : 'default';
          syncLayerControl(activeLayer);
          postMessage({ type: 'LAYER_TOGGLED', layer: activeLayer });
        };

        window.toggleLayer = function () {
          window.setMapLayer(
            window.currentLayer === defaultLayer ? 'satellite' : 'default'
          );
        };

        L.DomEvent.disableClickPropagation(layerToggleButton);
        L.DomEvent.disableScrollPropagation(layerToggleButton);
        layerToggleButton.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          window.toggleLayer();
        });

        function postCenter() {
          const currentCenter = window.map.getCenter();
          postMessage({
            type: 'CENTER_CHANGED',
            latitude: currentCenter.lat,
            longitude: currentCenter.lng,
          });
        }

        function postInteractionStart() {
          postMessage({ type: 'INTERACTION_START' });
        }

        function postInteractionEnd() {
          postMessage({ type: 'INTERACTION_END' });
        }

        window.map.on('movestart', postInteractionStart);
        window.map.on('moveend', function () {
          postCenter();
          postInteractionEnd();
        });
        window.map.on('zoomstart', postInteractionStart);
        window.map.on('zoomend', function () {
          postCenter();
          postInteractionEnd();
        });
        document.addEventListener('touchstart', postInteractionStart, { passive: true });
        document.addEventListener('touchend', postInteractionEnd, { passive: true });

        postMessage({ type: 'WEBVIEW_READY' });
        postCenter();
      } catch (error) {
        postMessage({
          type: 'CONSOLE_ERROR',
          message: error instanceof Error
            ? error.message
            : 'Unable to initialize the location map.',
        });
      }
    })();
  </script>
</body>
</html>
`;
}
