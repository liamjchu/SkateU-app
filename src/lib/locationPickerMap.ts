import { colors } from '../constants/colors';
import { getLeafletUserLocationScript } from './leafletUserLocation';
import {
    getCreateMapLibreMapScript,
    getMapLibreBaseCss,
    getMapLibreHeadTags,
} from './openFreeMap';

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
  ${getMapLibreHeadTags()}
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: ${colors.brand};
    }
    #map { height: 100%; width: 100%; }
    ${getMapLibreBaseCss()}
    #layer-toggle {
      display: none;
    }
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
      window.postToNative = postMessage;

      window.onerror = function (message, source, lineno) {
        postMessage({
          type: 'CONSOLE_ERROR',
          message: String(message) + ' at line ' + lineno,
        });
        return true;
      };

      try {
        ${getCreateMapLibreMapScript({ latitude, longitude, layer })}
        ${getLeafletUserLocationScript()}

        var layerToggleButton = document.getElementById('layer-toggle');
        if (layerToggleButton) {
          var isSatellite = window.currentLayer === 'satellite';
          layerToggleButton.setAttribute('aria-pressed', String(isSatellite));
          layerToggleButton.setAttribute(
            'aria-label',
            isSatellite
              ? 'Switch location map to standard map'
              : 'Switch location map to satellite map'
          );
          layerToggleButton.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            window.toggleLayer();
          });
        }

        function postCenter() {
          if (!window.map) return;
          var currentCenter = window.map.getCenter();
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

        window.onMapReady(function () {
          postMessage({ type: 'WEBVIEW_READY' });
          postCenter();
        });
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
