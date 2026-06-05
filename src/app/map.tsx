import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import images from '../constants/images';
import { useSpots } from '../context/SpotsContext';

export default function MapScreen() {
  const webViewRef = useRef<WebView>(null);
  const searchParams = useLocalSearchParams();
  const router = useRouter();
  const { spots } = useSpots();
  const webViewReadyRef = useRef(false);

  const schoolName = Array.isArray(searchParams.schoolName)
    ? searchParams.schoolName[0]
    : searchParams.schoolName;
  const displayedSchoolName = schoolName ?? 'Campus map';

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

      window.sendCenter = function () {
        try {
          if (!window.map || !window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) return;
          const center = window.map.getCenter();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'CURRENT_CENTER',
            latitude: center.lat,
            longitude: center.lng,
            layer: window.currentLayer === satelliteLayer ? 'satellite' : 'default',
          }));
        } catch (e) { console.error(e); }
      };

      window.markers = {};

      window.renderSpots = function (spotsData) {
        try {
          // Clear existing markers
          Object.values(window.markers).forEach(marker => marker.remove());
          window.markers = {};

          // Create new markers for each spot
          spotsData.forEach(spot => {
            const marker = L.marker([spot.latitude, spot.longitude], {
              title: spot.name,
            }).addTo(window.map);

            marker.on('click', () => {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MARKER_PRESS', id: spot.id }));
              }
            });

            // Create popup content with only marker information
            const popupContent = '<div style="color: white; max-width: 200px;">' +
              '<h3 style="margin: 0 0 8px 0; font-size: 16px;">' + spot.name + '</h3>' +
              '</div>';

            marker.bindPopup(popupContent);
            window.markers[spot.id] = marker;
          });
        } catch (e) { console.error('Error rendering spots:', e); }
        };

        // Notify React Native that the WebView has finished setting up
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'WEBVIEW_READY' }));
          }
        } catch (e) { console.error('Error posting WEBVIEW_READY', e); }
      </script>
  </body>
  </html>
  `;

  // Inject marker-only spot data into the map when spots change,
  // but only after the WebView has finished loading and signaled readiness.
  useEffect(() => {
    if (webViewRef.current && webViewReadyRef.current) {
      const markerData = spots.map(({ id, latitude, longitude, name }) => ({ id, latitude, longitude, name }));
      const markerJson = JSON.stringify(markerData);
      webViewRef.current.injectJavaScript(`window.renderSpots(${markerJson}); true;`);
    }
  }, [spots]);

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type: string;
        id?: string;
        latitude?: number;
        longitude?: number;
        layer?: string;
      };

      // When the WebView finishes loading, it will notify us so we can send markers
      if (data.type === 'WEBVIEW_READY') {
        webViewReadyRef.current = true;
        if (webViewRef.current) {
          const markerData = spots.map(({ id, latitude, longitude, name }) => ({ id, latitude, longitude, name }));
          const markerJson = JSON.stringify(markerData);
          webViewRef.current.injectJavaScript(`window.renderSpots(${markerJson}); true;`);
        }
        return;
      }

      if (data.type === 'CURRENT_CENTER' && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const layer = data.layer === 'satellite' ? 'satellite' : 'default';
        router.push(`/add-spot?lat=${data.latitude}&lng=${data.longitude}&layer=${layer}`);
        return;
      }

      if (data.type === 'MARKER_PRESS' && typeof data.id === 'string') {
        router.push({ pathname: '/spot/[id]', params: { id: data.id } });
      }
    } catch (error) {
      console.error('MapScreen message parse error', error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View
        className="absolute left-0 right-0 z-50 bg-slate-950/95 border-b border-white/10 px-4 pb-3 flex-row items-center justify-between"
        style={{ top: 0, paddingTop: 48 }}
      >
        <Pressable onPress={() => router.push('/')} className="rounded-full p-2">
          <Text className="text-white text-lg">←</Text>
        </Pressable>
        <Text className="flex-1 px-2 text-center text-base font-semibold text-white" numberOfLines={1} ellipsizeMode="tail">
          {displayedSchoolName}
        </Text>
        <View className="w-8" />
      </View>
      <Pressable
        style={styles.toggleButton}
        onPress={() => {
          webViewRef.current?.injectJavaScript(`window.toggleLayer(); true;`);
        }}
      >
        <Image source={images.layers} style={styles.icon} />
      </Pressable>
      <Pressable
        className="absolute bottom-6 right-4 bg-sky-600 w-14 h-14 rounded-full items-center justify-center shadow-lg z-50"
        onPress={() => {
          webViewRef.current?.injectJavaScript(`window.sendCenter(); true;`);
        }}
        accessibilityLabel="Add new spot"
      >
        <Text className="text-white text-2xl">+</Text>
      </Pressable>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={handleWebViewMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    position: 'absolute',
    top: '6.3%',
    right: 10,
    zIndex: 999,
    backgroundColor: 'rgb(0, 0, 0)',
    padding: 8,
    borderRadius: 999,
    transform: [{translateY: -20}],
  },
  icon: {
    width: 40,
    height: 40,
    tintColor: 'white',
  },
});
