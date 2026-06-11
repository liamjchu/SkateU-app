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

  const schoolId = Array.isArray(searchParams.schoolId)
    ? searchParams.schoolId[0]
    : searchParams.schoolId;
  const schoolName = Array.isArray(searchParams.schoolName)
    ? searchParams.schoolName[0]
    : searchParams.schoolName;
  const schoolCity = Array.isArray(searchParams.schoolCity)
    ? searchParams.schoolCity[0]
    : searchParams.schoolCity;
  const schoolState = Array.isArray(searchParams.schoolState)
    ? searchParams.schoolState[0]
    : searchParams.schoolState;
  const displayedSchoolName = schoolName ?? 'Campus map';
  const locationSubtitle = schoolCity && schoolState 
          ? `${schoolCity}, ${schoolState}` 
          : '';

  const lat = Number(searchParams.lat ?? '41.8268');
  const lng = Number(searchParams.lng ?? '-71.4010');
  const validLat = Number.isFinite(lat) ? lat : 41.8268;
  const validLng = Number.isFinite(lng) ? lng : -71.4010;

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
    <style>
      /* FIXED: Changed 100vh/100vw to 100%. WebViews often collapse vh/vw units to 0 */
      html, body { margin: 0; padding: 0; background: #21473f; width: 100%; height: 100%; }
      #map { height: 100%; width: 100%; }
      .leaflet-popup-content-wrapper { background: #21473f; color: white; border-radius: 12px; }
      .leaflet-popup-tip { background: #21473f; }
      .leaflet-control-attribution { display: none; }

      /*brightness of the map, darken it so the pin can show*/
      #map:not(.satellite) .leaflet-tile {
        filter: brightness(.9);
      }
      #map.satellite .leaflet-tile {
        filter: brightness(.8);
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      // 1. ERROR CATCHER: Send any JS errors inside the WebView back to React Native
      window.onerror = function(message, source, lineno, colno, error) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'CONSOLE_ERROR',
            message: message + ' at line ' + lineno
          }));
        }
        return true;
      };

      try {
        const center = [${validLat}, ${validLng}];
        const spotIcon = L.icon({
          iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12z" fill="%23FFFFFF" stroke="%23FFFFFF" stroke-width="0"/><circle cx="12" cy="10" r="2.5" fill="%2321473f"/></svg>',
          iconSize: [50, 50],
          iconAnchor: [25, 50],

          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          shadowSize: [41, 41],
          shadowAnchor: [13, 41],
        });

        window.map = L.map('map', { zoomControl: false }).setView(center, 15.5);
        const defaultLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png');
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png');

        window.currentLayer = defaultLayer.addTo(window.map);

        window.toggleLayer = function () {
          if (!window.map) return;
          if (window.currentLayer === defaultLayer) {
            window.map.removeLayer(defaultLayer);
            satelliteLayer.addTo(window.map);
            window.currentLayer = satelliteLayer;
            document.getElementById('map').classList.add('satellite');
          } else {
            window.map.removeLayer(satelliteLayer);
            defaultLayer.addTo(window.map);
            window.currentLayer = defaultLayer;
            document.getElementById('map').classList.remove('satellite');
          }
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LAYER_TOGGLED', layer: window.currentLayer === satelliteLayer ? 'satellite' : 'default' }));
          }
        };

        window.sendCenter = function () {
          if (!window.map || !window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) return;
          const center = window.map.getCenter();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'CURRENT_CENTER',
            latitude: center.lat,
            longitude: center.lng,
            layer: window.currentLayer === satelliteLayer ? 'satellite' : 'default',
          }));
        };

        window.markers = {};

        function escapeHtml(text) {
          return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\\//g, '&#x2F;');
        }

        window.renderSpots = function (spotsData) {
          Object.values(window.markers).forEach(marker => marker.remove());
          window.markers = {};

          spotsData.forEach(spot => {
            const marker = L.marker([spot.latitude, spot.longitude], {
              title: spot.name,
              icon: spotIcon,
            }).addTo(window.map);

            marker.on('click', () => {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MARKER_PRESS', id: spot.id }));
              }
            });

            window.markers[spot.id] = marker;
          });
        };

        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'WEBVIEW_READY' }));
        }
      } catch (e) {
        // Catch initialization errors (like 'L is not defined')
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'CONSOLE_ERROR',
            message: 'Init Error: ' + e.message
          }));
        }
      }
    </script>
  </body>
  </html>
  `;

  const sendMarkers = () => {
    if (!webViewRef.current) return;

    const markerData = spots.map(({ id, latitude, longitude, name }) => ({ id, latitude, longitude, name }));
    const markerJson = JSON.stringify(markerData);
    webViewRef.current.injectJavaScript(`window.renderSpots(${markerJson}); true;`);
  };

  // Inject marker-only spot data into the map when spots change,
  // but only after the WebView has finished loading and signaled readiness.
  useEffect(() => {
    if (webViewRef.current && webViewReadyRef.current) {
      sendMarkers();
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
        sendMarkers();
        return;
      }

      if (data.type === 'CURRENT_CENTER' && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const layer = data.layer === 'satellite' ? 'satellite' : 'default';
        const params = new URLSearchParams();
        params.set('lat', data.latitude.toString());
        params.set('lng', data.longitude.toString());
        params.set('layer', layer);
        if (schoolId) params.set('schoolId', schoolId);
        router.push(`/add-spot?${params.toString()}`);
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
        className="absolute left-0 right-0 z-50 bg-[#21473f] border-b border-white/10 px-4 pb-3 flex-row items-center justify-between"
        style={{
          top: 0, paddingTop: 70,
          
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,

          elevation: 12,
        }}
      >
        <Pressable onPress={() => router.push('/')} className="rounded-full p-2">
          <Text className="text-white text-xl">❮</Text>
        </Pressable>

        <View className="flex-1 max-w-80 items-center">
          <Text
            style={{ fontFamily: 'Outfit_700Bold' }}
            className="text-2xl text-white"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayedSchoolName}
          </Text>
          {locationSubtitle && (
            <Text
              style={{ fontFamily: 'Outfit_500Medium' }}
              className="text-m text-[`#e8f0ee`]"
              numberOfLines={1}
            >
              {locationSubtitle}
            </Text>
          )}
        </View>

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
        className="absolute bottom-6 right-4 bg-[#21473f] w-18 h-18 rounded-full items-center justify-center shadow-lg z-50"
        onPress={() => {
          webViewRef.current?.injectJavaScript(`window.sendCenter(); true;`);
        }}
        accessibilityLabel="Add new spot"
      >
        <Text className="text-white text-4xl">+</Text>
      </Pressable>
      <WebView
        ref={webViewRef}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        originWhitelist={['*']}
        source={{ 
          html: html,
          // The baseUrl is the magic fix. It gives the HTML an HTTP origin, 
          // allowing it to successfully bypass CORS/security blocks to fetch Leaflet.
          baseUrl: 'https://localhost' 
        }}
        // Explicitly enable JS and DOM Storage (critical for map libraries)
        javaScriptEnabled={true}
        domStorageEnabled={true}
        // Allow mixed content so HTTPS tiles can load over the base URL
        mixedContentMode="always"
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
    backgroundColor: 'rgba(0, 0, 0, .4)',
    padding: 8,
    borderRadius: 999,
    transform: [{translateY: 80}],

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,

    elevation: 10,
  },
  icon: {
    width: 30,
    height: 30,
    tintColor: 'white',
  },
});
