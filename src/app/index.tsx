import { View } from 'react-native'; 
import { WebView, WebViewMessageEvent } from 'react-native-webview'; 
import { useRef } from 'react'; 

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { margin: 0; padding: 0; background: #0b0f14; }
    #map { height: 100vh; width: 100vw; }
    .leaflet-popup-content-wrapper { background: #111827; color: white; border-radius: 12px; }
    .leaflet-popup-tip { background: #111827; }
    .leaflet-control-attribution { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const center = [41.8268, -71.4010];
    window.map = L.map('map', { zoomControl: false, minZoom: 14.5 }).setView(center, 15.5);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', 
      { subdomains: 'abcd' }
    ).addTo(window.map);

    const bounds = L.latLngBounds([41.8068, -71.4210], [41.8468, -71.3810]);
    window.map.setMaxBounds(bounds);
    window.map.on('drag', () => window.map.panInsideBounds(bounds));
    window.bounds = bounds;

    // LEAFLET HANDLES THE CLICKS: Calculates precise latitude/longitude automatically
    window.map.on('click', function(e) {
      const payload = {
        type: 'MAP_TAP',
        latlng: e.latlng
      };
      // Sends data cleanly out to React Native
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    });
  </script>
</body>
</html>
`;

// Clean injected script for adding markers dynamically
const injectedJavaScript = `
  (function () {
    window.addMapMarker = function (lat, lng) {
      if (!window.map || !window.bounds) return;
      const latlng = L.latLng(lat, lng);
      
      if (!window.bounds.contains(latlng)) return;
      
      L.marker(latlng).addTo(window.map);
    };
  })();
  true; // Absolute requirement: Injected strings must evaluate to true
`;

export default function Index() {
  const webViewRef = useRef<WebView>(null);

  // Catches precise coordinate data sent from Leaflet
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const rawData = event?.nativeEvent?.data;
      if (!rawData) return;

      const data = JSON.parse(rawData);

      if (data.type === 'MAP_TAP') {
        const { lat, lng } = data.latlng;
        
        // This is where you would open your NativeWind modal form!
        // For now, we instantly inject it back to draw the marker:
        const js = `window.addMapMarker(${lat}, ${lng}); true;`;
        webViewRef.current?.injectJavaScript(js);
      }
    } catch (err) {
      console.error("Error handling WebView message:", err);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <WebView 
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }} 
        injectedJavaScript={injectedJavaScript}
        onMessage={handleWebViewMessage} // Safely handles incoming map coordinates
      />
    </View>
  );
}
