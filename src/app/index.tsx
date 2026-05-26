import { View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function Index() {
  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />

  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #0b0f14;
    }

    #map {
      height: 100vh;
      width: 100vw;
    }

    /* Dark popup styling */
    .leaflet-popup-content-wrapper {
      background: #111827;
      color: white;
      border-radius: 12px;
    }

    .leaflet-popup-tip {
      background: #111827;
    }

    /* Hide attribution for cleaner UI (optional) */
    .leaflet-control-attribution {
      display: none;
    }
  </style>
</head>

<body>
  <div id="map"></div>

  <script>
  //start location  
  var map = L.map('map', {
      zoomControl: false
    }).setView([41.8268, -71.4010], 15.5);
    
  // map style
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd',
}).addTo(map);

// Limit scrolling area
var bounds = L.latLngBounds(
  [41.8068, -71.3810],
  [41.8468, -71.4210]
);

//limit zoom area
map.on('zoomend', function () {
  if (map.getZoom() < 14.5) {
    map.setZoom(14.5);
  }
  if (map.getZoom() > 100) {
    map.setZoom(100);
  }
});

map.setMaxBounds(bounds);
map.on('drag', function () {
  map.panInsideBounds(bounds, { animate: false });
});

  </script>
</body>
</html>
          `
        }}
      />
    </View>
  );
}