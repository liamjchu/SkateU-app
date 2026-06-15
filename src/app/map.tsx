import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import images from '../constants/images';
import { useSpots } from '../context/SpotsContext';
import { useFavorites } from '../store/favoritesStore';
import { useSchools } from '../store/schoolsStore';
import type { School } from '../types/school';

const COLLAPSED_SHEET_HEIGHT = 100;

export default function MapScreen() {
  const webViewRef = useRef<WebView>(null);
  const searchParams = useLocalSearchParams();
  const router = useRouter();
  const { spots, removeSpot } = useSpots();
  const { schools, upsertSchool } = useSchools();
  const { favoriteSchoolIds, toggleFavoriteSchool } = useFavorites();
  const webViewReadyRef = useRef(false);
  const [selectedSpotId, setSelectedSpotId] = useState<string | undefined>();
  const sheetHeight = useSharedValue(0);
  const sheetTranslateY = useSharedValue(0);
  const sheetStartY = useSharedValue(0);

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
  const schoolNumSpotsParam = Array.isArray(searchParams.schoolNumSpots)
    ? searchParams.schoolNumSpots[0]
    : searchParams.schoolNumSpots;
  const displayedSchoolName = schoolName ?? 'Campus map';
  const locationSubtitle = schoolCity && schoolState 
          ? `${schoolCity}, ${schoolState}` 
          : '';

  const lat = Number(searchParams.lat ?? '41.8268');
  const lng = Number(searchParams.lng ?? '-71.4010');
  const validLat = Number.isFinite(lat) ? lat : 41.8268;
  const validLng = Number.isFinite(lng) ? lng : -71.4010;
  const schoolNumSpots = Number(schoolNumSpotsParam ?? '0');
  const currentSchool = useMemo<School | null>(() => {
    if (!schoolId || !schoolName) {
      return null;
    }

    const savedSchool = schools.find((school) => school.id === schoolId);

    return {
      id: schoolId,
      name: schoolName,
      lat: savedSchool?.lat ?? validLat,
      lng: savedSchool?.lng ?? validLng,
      city: savedSchool?.city ?? schoolCity ?? '',
      state: savedSchool?.state ?? schoolState ?? '',
      numSpots: savedSchool?.numSpots ?? (Number.isFinite(schoolNumSpots) ? schoolNumSpots : 0),
      type: savedSchool?.type,
    };
  }, [
    schoolCity,
    schoolId,
    schoolName,
    schoolNumSpots,
    schoolState,
    schools,
    validLat,
    validLng,
  ]);
  const isFavoriteSchool = currentSchool
    ? favoriteSchoolIds.includes(currentSchool.id)
    : false;
  const selectedSpot = useMemo(
    () => spots.find((spot) => spot.id === selectedSpotId),
    [selectedSpotId, spots]
  );

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

  useEffect(() => {
    if (selectedSpotId && !selectedSpot) {
      setSelectedSpotId(undefined);
    }
  }, [selectedSpot, selectedSpotId]);

  useEffect(() => {
    if (selectedSpot) {
      sheetTranslateY.value = 0;
      sheetStartY.value = 0;
    }
  }, [selectedSpot, sheetStartY, sheetTranslateY]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const sheetPanGesture = Gesture.Pan()
    .onBegin(() => {
      sheetStartY.value = sheetTranslateY.value;
    })
    .onUpdate((event) => {
      const collapsedOffset = Math.max(
        sheetHeight.value - COLLAPSED_SHEET_HEIGHT,
        0
      );
      const nextOffset = sheetStartY.value + event.translationY;

      sheetTranslateY.value = Math.min(
        Math.max(nextOffset, 0),
        collapsedOffset
      );
    })
    .onEnd((event) => {
      const collapsedOffset = Math.max(
        sheetHeight.value - COLLAPSED_SHEET_HEIGHT,
        0
      );
      const shouldCollapse =
        event.velocityY > 250 ||
        (event.velocityY >= -250 &&
          sheetTranslateY.value > collapsedOffset / 2);
      const nextOffset = shouldCollapse ? collapsedOffset : 0;

      sheetTranslateY.value = withTiming(nextOffset, {
        duration: 160,
        easing: Easing.out(Easing.cubic),
      });
    });

  const handleDeleteSpot = useCallback(() => {
    if (!selectedSpot) return;

    Alert.alert(
      'Delete spot',
      'Are you sure you want to permanently delete this spot?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeSpot(selectedSpot.id);
              setSelectedSpotId(undefined);
            } catch (error) {
              console.warn('Failed to delete spot', error);
            }
          },
        },
      ]
    );
  }, [removeSpot, selectedSpot]);

  const handleFavoritePress = useCallback(() => {
    if (!currentSchool) return;

    upsertSchool(currentSchool);
    toggleFavoriteSchool(currentSchool);
  }, [currentSchool, toggleFavoriteSchool, upsertSchool]);

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
        if (data.id === selectedSpotId) {
          const collapsedOffset = Math.max(
            sheetHeight.value - COLLAPSED_SHEET_HEIGHT,
            0
          );

          sheetTranslateY.value = withTiming(collapsedOffset, {
            duration: 160,
            easing: Easing.out(Easing.cubic),
          });
          setSelectedSpotId(undefined);
          return;
        }

        setSelectedSpotId(data.id);
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
        <Pressable
          onPress={() => router.push('/')}
          className="h-11 w-11 items-center justify-center rounded-full"
        >
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
              className="text-m text-[#e8f0ee]"
              numberOfLines={1}
            >
              {locationSubtitle}
            </Text>
          )}
        </View>

        {currentSchool ? (
          <Pressable
            onPress={handleFavoritePress}
            className="h-11 w-11 items-center justify-center rounded-full"
            accessibilityLabel={
              isFavoriteSchool ? 'Remove school from favorites' : 'Add school to favorites'
            }
            accessibilityRole="button"
          >
            <Text
              className={`-mt-1 text-3xl ${
                isFavoriteSchool ? 'text-white' : 'text-white/70'
              }`}
            >
              {isFavoriteSchool ? '★' : '☆'}
            </Text>
          </Pressable>
        ) : (
          <View className="h-11 w-11" />
        )}
      </View>
      <Pressable
        style={styles.toggleButton}
        onPress={() => {
          webViewRef.current?.injectJavaScript(`window.toggleLayer(); true;`);
        }}
        accessibilityLabel="Toggle map layer"
        accessibilityRole="button"
      >
        <Image source={images.layers} style={styles.icon} />
      </Pressable>
      <Pressable
        className="absolute bottom-6 right-4 bg-[#21473f] w-18 h-18 rounded-full items-center justify-center shadow-lg z-50"
        onPress={() => {
          setSelectedSpotId(undefined);
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

      {selectedSpot && (
        <Animated.View
          entering={SlideInDown.duration(240)}
          exiting={SlideOutDown.duration(220)}
          onLayout={(event) => {
            sheetHeight.value = event.nativeEvent.layout.height;
          }}
          style={[styles.sheet, sheetAnimatedStyle]}
        >
          <GestureDetector gesture={sheetPanGesture}>
            <View>
              <View className="mb-3 h-1.5 w-12 self-center rounded-full bg-slate-300" />
              <View className="flex-row items-center justify-between bg-white pb-3">
                <Text
                  className="flex-1 pr-3 text-lg font-semibold"
                  style={{ fontFamily: 'Outfit_700Bold' }}
                  numberOfLines={1}
                >
                  {selectedSpot.name}
                </Text>
                <Pressable
                  onPress={() => setSelectedSpotId(undefined)}
                  className="px-2 py-1"
                >
                  <Text
                    className="text-sky-600"
                    style={{ fontFamily: 'Outfit_600SemiBold' }}
                  >
                    Close
                  </Text>
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedSpot.imageUris.length > 0 ? (
              <Image
                source={{ uri: selectedSpot.imageUris[0] }}
                style={styles.sheetImage}
                resizeMode="cover"
              />
            ) : (
              <View className="mt-6 h-80 items-center justify-center rounded-3xl bg-slate-100">
                <Text
                  className="text-slate-500"
                  style={{ fontFamily: 'Outfit_500Medium' }}
                >
                  No image available
                </Text>
              </View>
            )}

            <Text
              className="mt-6 text-sm text-slate-500"
              style={{ fontFamily: 'Outfit_500Medium' }}
            >
              {selectedSpot.description}
            </Text>

            <Pressable
              onPress={handleDeleteSpot}
              className="mt-6 items-center justify-center rounded-3xl bg-red-600 py-4"
            >
              <Text
                className="font-semibold text-white"
                style={{ fontFamily: 'Outfit_600SemiBold' }}
              >
                Delete Spot
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    maxHeight: '70%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
  sheetContent: {
    paddingBottom: 32,
  },
  sheetImage: {
    width: '100%',
    height: 280,
    borderRadius: 24,
    marginTop: 12,
  },
  toggleButton: {
    position: 'absolute',
    top: 150,
    right: 10,
    zIndex: 999,
    backgroundColor: 'rgba(0, 0, 0, .4)',
    padding: 8,
    borderRadius: 999,

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
