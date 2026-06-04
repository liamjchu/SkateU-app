import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import images from '../constants/images';

export default function MapScreen() {
  const webViewRef = useRef<WebView>(null);
  const searchParams = useLocalSearchParams();

  const lat = Number(searchParams.lat ?? '41.8268');
  const lng = Number(searchParams.lng ?? '-71.4010');
  const validLat = Number.isFinite(lat) ? lat : 41.8268;
  const validLng = Number.isFinite(lng) ? lng : -71.4010;

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
      const center = [${validLat}, ${validLng}];
      window.map = L.map('map', { zoomControl: false }).setView(center, 15.5);
      const defaultLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png');
      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png');

      window.currentLayer = defaultLayer.addTo(window.map);

      window.toggleLayer = function () {
        try {
          if (!window.map) return;
          if (window.currentLayer === defaultLayer) {
            window.map.removeLayer(defaultLayer);
            satelliteLayer.addTo(window.map);
            window.currentLayer = satelliteLayer;
          } else {
            window.map.removeLayer(satelliteLayer);
            defaultLayer.addTo(window.map);
            window.currentLayer = defaultLayer;
          }
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LAYER_TOGGLED', layer: window.currentLayer === satelliteLayer ? 'satellite' : 'default' }));
          }
        } catch (e) { console.error(e); }
      };
    </script>
  </body>
  </html>
  `;

  return (
    <View style={{ flex: 1 }}>
      <Pressable
        style={styles.toggleButton}
        onPress={() => {
          webViewRef.current?.injectJavaScript(`window.toggleLayer(); true;`);
        }}
      >
        <Image source={images.layers} style={styles.icon} />
      </Pressable>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    position: 'absolute',
    top: '50%',
    right: 16,
    zIndex: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 999,
    transform: [{translateY: -20}],
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: 'white',
  },
});
