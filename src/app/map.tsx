import { Feather, Octicons } from '@expo/vector-icons';
import {
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import FeedbackPressable from '../components/FeedbackPressable';
import LoginRequiredModal from '../components/LoginRequiredModal';
import images from '../constants/images';
import { triggerHaptic } from '../lib/haptics';
import { formatRelativeTime } from '../lib/relativeTime';
import { useAuthStore } from '../store/authStore';
import { useFavorites } from '../store/favoritesStore';
import { useSchools } from '../store/schoolsStore';
import { useSpotsStore } from '../store/spotsStore';
import type { School } from '../types/school';

const COLLAPSED_SHEET_HEIGHT = 100;

export default function MapScreen() {
  const webViewRef = useRef<WebView>(null);
  const searchParams = useLocalSearchParams();
  const router = useRouter();
  const initialSpotId = Array.isArray(searchParams.spotId)
    ? searchParams.spotId[0]
    : searchParams.spotId;
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const isTabletLayout = width >= 768 && height >= 600;
  const tabletSheetWidth = Math.min(width - 48, 520);
  const session = useAuthStore((state) => state.session);
  const spots = useSpotsStore((s) => s.spots);
  const mySpots = useSpotsStore((s) => s.mySpots);
  const myLoading = useSpotsStore((s) => s.myLoading);
  const deleteSpot = useSpotsStore((s) => s.deleteSpot);
  const toggleSpotLike = useSpotsStore((s) => s.toggleSpotLike);
  const fetchMySpots = useSpotsStore((s) => s.fetchMySpots);
  const loading = useSpotsStore((s) => s.loading);
  const error = useSpotsStore((s) => s.error);
  const fetchSpots = useSpotsStore((s) => s.fetchSpots);
  const { schools, upsertSchool } = useSchools();
  const { favoriteSchoolIds, toggleFavoriteSchool } = useFavorites();
  const webViewReadyRef = useRef(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mapError, setMapError] = useState('');
  const [selectedSpotId, setSelectedSpotId] = useState<string | undefined>(initialSpotId);
  const [mapLayer, setMapLayer] = useState<'default' | 'satellite'>(
    searchParams.layer === 'satellite' ? 'satellite' : 'default'
  );
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  const [likingSpotId, setLikingSpotId] = useState<string | null>(null);
  const [deletingSpotId, setDeletingSpotId] = useState<string | null>(null);
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
  const selectedSpotIsOwned = Boolean(
    session?.user &&
      selectedSpot &&
      !myLoading &&
      mySpots.some((spot) => spot.id === selectedSpot.id)
  );

  // Show "edited …" when the spot was changed after creation, otherwise
  // "added …". created_at and updated_at both default to now() on insert, so a
  // small threshold avoids labelling a brand-new spot as edited.
  const spotTimeInfo = useMemo(() => {
    if (!selectedSpot) {
      return null;
    }

    const createdMs = Date.parse(selectedSpot.createdAt);
    const updatedMs = Date.parse(selectedSpot.updatedAt);
    const wasEdited =
      Number.isFinite(createdMs) &&
      Number.isFinite(updatedMs) &&
      updatedMs - createdMs > 2000;

    const relative = formatRelativeTime(
      wasEdited ? selectedSpot.updatedAt : selectedSpot.createdAt
    );
    if (!relative) {
      return null;
    }

    return { label: wasEdited ? 'edited' : 'added', relative };
  }, [selectedSpot]);

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
        const reportTileError = function () {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'CONSOLE_ERROR',
              message: 'Map tiles could not be loaded.'
            }));
          }
        };
        defaultLayer.on('tileerror', reportTileError);
        satelliteLayer.on('tileerror', reportTileError);

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

  const sendMarkers = useCallback(() => {
    if (!webViewRef.current) return;

    const markerData = spots.map(({ id, latitude, longitude, name }) => ({ id, latitude, longitude, name }));
    const markerJson = JSON.stringify(markerData);
    webViewRef.current.injectJavaScript(`window.renderSpots(${markerJson}); true;`);
  }, [spots]);

  // Inject marker-only spot data into the map when spots change,
  // but only after the WebView has finished loading and signaled readiness.
  useEffect(() => {
    if (webViewRef.current && webViewReadyRef.current) {
      sendMarkers();
    }
  }, [sendMarkers, spots]);

  // Refetch when the screen regains focus so a spot just created on the
  // add-spot screen shows up on return.
  useFocusEffect(
    useCallback(() => {
      if (schoolId) {
        fetchSpots(schoolId, session?.access_token);
      }

      if (session?.access_token) {
        fetchMySpots(session.access_token);
      }
    }, [fetchMySpots, fetchSpots, schoolId, session?.access_token])
  );

  useEffect(() => {
    if (mapStatus !== 'loading') {
      return;
    }

    const timeout = setTimeout(() => {
      webViewReadyRef.current = false;
      setMapStatus('error');
      setMapError('The campus map took too long to load.');
    }, 12_000);

    return () => clearTimeout(timeout);
  }, [mapAttempt, mapStatus]);

  useEffect(() => {
    if (initialSpotId && spots.some((spot) => spot.id === initialSpotId)) {
      setSelectedSpotId(initialSpotId);
    }
  }, [initialSpotId, spots]);

  const retryMap = useCallback(() => {
    webViewReadyRef.current = false;
    setMapError('');
    setMapStatus('loading');
    setMapAttempt((attempt) => attempt + 1);
  }, []);

  const retrySpots = useCallback(() => {
    if (schoolId) {
      fetchSpots(schoolId, session?.access_token);
    }
  }, [fetchSpots, schoolId, session?.access_token]);

  useEffect(() => {
    if (selectedSpotId && !selectedSpot) {
      setSelectedSpotId(undefined);
    }
  }, [selectedSpot, selectedSpotId]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!selectedSpotId) {
          return false;
        }

        setSelectedSpotId(undefined);
        return true;
      }
    );

    return () => subscription.remove();
  }, [selectedSpotId]);

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

  const handleFavoritePress = useCallback(() => {
    if (!currentSchool) return;

    upsertSchool(currentSchool);
    toggleFavoriteSchool(currentSchool);
  }, [currentSchool, toggleFavoriteSchool, upsertSchool]);

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }, [router]);

  const handleAddSpotPress = () => {
    if (!session) {
      setShowLoginRequired(true);
      return;
    }

    setSelectedSpotId(undefined);
    webViewRef.current?.injectJavaScript(`window.sendCenter(); true;`);
  };

  const handleLikePress = async () => {
    if (!selectedSpot) {
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setShowLoginRequired(true);
      return;
    }

    if (likingSpotId) {
      return;
    }

    setLikingSpotId(selectedSpot.id);
    try {
      await toggleSpotLike(
        selectedSpot.id,
        selectedSpot.likedByUser === true,
        accessToken
      );
      triggerHaptic('light');
    } catch (error) {
      Alert.alert(
        'Could not update like',
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setLikingSpotId(null);
    }
  };

  const handleEditSelectedSpot = () => {
    if (!selectedSpot || !selectedSpotIsOwned || deletingSpotId) {
      return;
    }

    router.push(`/edit-spot?id=${encodeURIComponent(selectedSpot.id)}`);
  };

  const handleDeleteSelectedSpot = () => {
    if (!selectedSpot || !selectedSpotIsOwned || deletingSpotId) {
      return;
    }

    triggerHaptic('warning');
    const spotToDelete = selectedSpot;
    Alert.alert(
      'Delete spot?',
      `"${spotToDelete.name}" will be permanently removed for everyone. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const accessToken = session?.access_token;
            if (!accessToken) {
              Alert.alert('You must be signed in to delete a spot.');
              return;
            }

            setDeletingSpotId(spotToDelete.id);

            try {
              await deleteSpot(spotToDelete.id, accessToken);
              setSelectedSpotId(undefined);
            } catch (error) {
              Alert.alert(
                'Could not delete spot',
                error instanceof Error && error.message.length > 0
                  ? error.message
                  : 'Please try again.'
              );
            } finally {
              setDeletingSpotId(null);
            }
          },
        },
      ]
    );
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type: string;
        id?: string;
        message?: string;
        latitude?: number;
        longitude?: number;
        layer?: string;
      };

      // When the WebView finishes loading, it will notify us so we can send markers
      if (data.type === 'WEBVIEW_READY') {
        webViewReadyRef.current = true;
        setMapStatus('ready');
        setMapError('');
        sendMarkers();
        return;
      }

      if (data.type === 'CONSOLE_ERROR') {
        webViewReadyRef.current = false;
        setMapStatus('error');
        setMapError(
          data.message && data.message.length > 0
            ? data.message
            : 'The campus map could not be initialized.'
        );
        return;
      }

      if (data.type === 'LAYER_TOGGLED') {
        setMapLayer(data.layer === 'satellite' ? 'satellite' : 'default');
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
        triggerHaptic('selection');
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
        className="absolute left-0 right-0 z-50 h-[126px] bg-[#21473f] border-b border-white/10 px-4 pb-3 flex-row items-center justify-between"
        style={{
          top: 0, paddingTop: insets.top,
          
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,

          elevation: 12,
        }}
      >
        <FeedbackPressable
          haptic="light"
          onPress={handleBackPress}
          className="h-12 w-12 items-center justify-center rounded-full"
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text className="text-white text-xl">❮</Text>
        </FeedbackPressable>

        <View
          pointerEvents="none"
          className="absolute left-0 right-0 items-center justify-center px-20"
          style={{ top: insets.top, bottom: 12 }}
        >
          <Text
            style={{ fontFamily: 'Outfit_700Bold' }}
            className="text-center text-2xl text-white"
          >
            {displayedSchoolName}
          </Text>
          {locationSubtitle && (
            <Text
              style={{ fontFamily: 'Outfit_500Medium' }}
              className="text-center text-m text-[#e8f0ee]"
            >
              {locationSubtitle}
            </Text>
          )}
        </View>

        {currentSchool ? (
          <FeedbackPressable
            haptic="selection"
            onPress={handleFavoritePress}
            className="h-12 w-12 items-center justify-center rounded-full"
            accessibilityLabel={
              isFavoriteSchool ? 'Remove school from favorites' : 'Add school to favorites'
            }
            accessibilityRole="button"
          >
            <Octicons
              name={isFavoriteSchool ? 'star-fill' : 'star'}
              size={26}
              color={isFavoriteSchool ? '#FFFFFF' : 'rgba(255,255,255,0.7)'}
            />
          </FeedbackPressable>
        ) : (
          <View className="h-11 w-11" />
        )}
      </View>
      <FeedbackPressable
        haptic="selection"
        className="absolute right-[10px] z-[999] rounded-full bg-[rgba(0,0,0,0.4)] p-2"
        style={[styles.toggleButton, { top: 134 }]}
        onPress={() => {
          webViewRef.current?.injectJavaScript(`window.toggleLayer(); true;`);
        }}
        accessibilityLabel={
          mapLayer === 'satellite'
            ? 'Switch to standard map'
            : 'Switch to satellite map'
        }
        accessibilityRole="button"
        accessibilityState={{ selected: mapLayer === 'satellite' }}
      >
        <Image source={images.layers} style={styles.icon} />
      </FeedbackPressable>
      <FeedbackPressable
        haptic="light"
        className="absolute right-4 bg-[#21473f] w-18 h-18 rounded-full items-center justify-center shadow-lg z-50"
        style={{ bottom: Math.max(insets.bottom, 16) }}
        onPress={handleAddSpotPress}
        accessibilityLabel="Add new spot"
        accessibilityRole="button"
        accessibilityHint="Opens the form to add a skate spot"
      >
        <Text className="text-white text-4xl">+</Text>
      </FeedbackPressable>
      <LoginRequiredModal
        visible={showLoginRequired}
        onCancel={() => setShowLoginRequired(false)}
      />
      <WebView
        accessibilityLabel={`Campus map for ${displayedSchoolName}. ${spots.length} skate ${spots.length === 1 ? 'spot' : 'spots'} available. Use the map or the accessible spot actions to select a spot.`}
        accessibilityActions={spots.map((spot) => ({
          name: `select-${spot.id}`,
          label: `Select ${spot.name}`,
        }))}
        onAccessibilityAction={(event) => {
          const spotId = event.nativeEvent.actionName.replace('select-', '');
          if (spots.some((spot) => spot.id === spotId)) {
            setSelectedSpotId(spotId);
          }
        }}
        key={mapAttempt}
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
        onLoadStart={() => {
          webViewReadyRef.current = false;
          setMapStatus('loading');
          setMapError('');
        }}
        onError={() => {
          webViewReadyRef.current = false;
          setMapStatus('error');
          setMapError('The campus map could not be loaded.');
        }}
        onHttpError={() => {
          webViewReadyRef.current = false;
          setMapStatus('error');
          setMapError('The campus map could not be loaded.');
        }}
        onMessage={handleWebViewMessage}
      />

      {mapStatus === 'loading' ? (
        <View className="absolute inset-0 z-40 items-center justify-center bg-[#21473f]/90 px-8">
          <ActivityIndicator color="#FFFFFF" />
          <Text className="mt-3 text-center font-outfit-medium text-base text-white">
            Loading campus map…
          </Text>
        </View>
      ) : mapStatus === 'error' ? (
        <View
          className="absolute inset-0 z-40 items-center justify-center bg-[#21473f]/95 px-8"
          accessibilityLabel={`Map unavailable. ${mapError || 'Check your connection and try again.'}`}
        >
          <Text className="text-center font-outfit-bold text-xl text-white">
            Map unavailable
          </Text>
          <Text className="mt-2 text-center font-outfit-medium text-base text-white/80">
            Check your connection and try again.
          </Text>
          <FeedbackPressable
            onPress={retryMap}
            className="mt-5 rounded-2xl bg-white px-6 py-3"
            accessibilityRole="button"
            accessibilityLabel="Retry loading campus map"
          >
            <Text className="font-outfit-bold text-base text-[#21473f]">Retry</Text>
          </FeedbackPressable>
        </View>
      ) : null}

      {mapStatus === 'ready' && error ? (
        <View
          className="absolute left-4 right-4 z-40 rounded-2xl border border-[#F3B7B2] bg-white px-4 py-3"
          style={{ top: insets.top + 142 }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="font-outfit-bold text-sm text-[#B45F58]"
              >
                Spots unavailable
              </Text>
              <Text className="mt-0.5 font-outfit-medium text-xs text-slate-500">
                The map loaded, but spots could not be refreshed.
              </Text>
            </View>
            <FeedbackPressable
              onPress={retrySpots}
              className="rounded-xl bg-[#21473f] px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="Retry loading skate spots"
            >
              <Text className="font-outfit-bold text-xs text-white">Retry</Text>
            </FeedbackPressable>
          </View>
        </View>
      ) : mapStatus === 'ready' && loading ? (
        <View
          className="absolute left-0 right-0 z-40 items-center"
          style={{ top: insets.top + 142 }}
        >
          <View className="flex-row items-center rounded-full bg-black/50 px-3 py-1.5">
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text className="ml-2 font-outfit-medium text-xs text-white">
              Loading spots…
            </Text>
          </View>
        </View>
      ) : null}

      {mapStatus === 'ready' && !loading && !error && spots.length === 0 ? (
        <View className="absolute left-6 right-6 top-1/2 z-30 -translate-y-1/2 items-center rounded-3xl bg-white px-6 py-6 shadow-lg">
          <Feather name="map-pin" size={28} color="#21473f" />
          <Text className="mt-3 text-center font-outfit-bold text-xl text-[#1B3B36]">
            No skate spots here yet
          </Text>
          <Text className="mt-1.5 text-center font-outfit-medium text-sm leading-5 text-slate-500">
            Be the first to add a spot to this campus.
          </Text>
          <FeedbackPressable
            onPress={handleAddSpotPress}
            className="mt-5 rounded-2xl bg-[#21473f] px-5 py-3"
            accessibilityRole="button"
            accessibilityLabel="Add the first spot"
          >
            <Text className="font-outfit-bold text-base text-white">Add the first spot</Text>
          </FeedbackPressable>
        </View>
      ) : null}

      {selectedSpot && (
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={`${selectedSpot.name} spot details`}
          entering={SlideInDown.duration(240)}
          exiting={SlideOutDown.duration(220)}
          onLayout={(event) => {
            sheetHeight.value = event.nativeEvent.layout.height;
          }}
          style={[
            styles.sheet,
            isTabletLayout && {
              left: 24,
              right: undefined,
              width: tabletSheetWidth,
              maxHeight: '72%',
            },
            { paddingBottom: Math.max(insets.bottom, 16) + 16 },
            sheetAnimatedStyle,
          ]}
        >
          <GestureDetector gesture={sheetPanGesture}>
            <View>
              <View className="mb-3 h-1.5 w-12 self-center rounded-full bg-slate-300" />
              <View className="flex-row items-start justify-between bg-white pb-3">
                <View className="flex-1 pr-3">
                  <Text className="font-outfit-bold text-lg">
                    {selectedSpot.name}
                  </Text>
                  <View className="mt-1 flex-row items-center">
                    <Octicons name="person" size={13} color="#64748b" />
                    <Text
                      className="ml-1 font-outfit-medium text-xs text-slate-500"
                  >
                      {selectedSpot.creatorUsername
                        ? `@${selectedSpot.creatorUsername}`
                        : 'Deleted User'}
                    </Text>
                    {spotTimeInfo ? (
                      <>
                        <Text
                          className="mx-1.5 font-outfit-medium text-xs text-slate-400"
                        >
                          ·
                        </Text>
                        <Text
                          className="font-outfit-medium text-xs text-slate-500"
                        >
                          {`${spotTimeInfo.label} ${spotTimeInfo.relative}`}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>
                <View className="flex-row items-center">
                  <FeedbackPressable
                    onPress={handleLikePress}
                    disabled={likingSpotId === selectedSpot.id}
                    className="mr-2 flex-row items-center rounded-full bg-[#F4F7F6] px-3 py-2"
                    accessibilityLabel={
                      selectedSpot.likedByUser === true
                        ? `Unlike ${selectedSpot.name}`
                        : `Like ${selectedSpot.name}`
                    }
                    accessibilityRole="button"
                  >
                    {likingSpotId === selectedSpot.id ? (
                      <ActivityIndicator size="small" color="#B45F58" />
                    ) : (
                      <Octicons
                        name={
                          selectedSpot.likedByUser === true
                            ? 'heart-fill'
                            : 'heart'
                        }
                        size={17}
                        color={
                          selectedSpot.likedByUser === true
                            ? '#B45F58'
                            : '#64748b'
                        }
                      />
                    )}
                    <Text className="ml-1.5 font-outfit-semibold text-sm text-slate-600">
                      {selectedSpot.likeCount ?? 0}
                    </Text>
                  </FeedbackPressable>
                  <FeedbackPressable
                    haptic="selection"
                    onPress={() => setSelectedSpotId(undefined)}
                    className="min-h-12 min-w-12 items-center justify-center rounded-full px-2 py-1"
                    accessibilityRole="button"
                    accessibilityLabel={`Close ${selectedSpot.name} details`}
                  >
                    <Text
                      className="font-outfit-semibold text-sky-600"
                    >
                      Close
                    </Text>
                  </FeedbackPressable>
                </View>
              </View>
            </View>
          </GestureDetector>

          <ScrollView
            contentContainerClassName="pb-[24px]"
            showsVerticalScrollIndicator={false}
          >
            {selectedSpot.imageUris.length > 0 ? (
              <Image
                source={{ uri: selectedSpot.imageUris[0] }}
                accessibilityLabel={`Photo of ${selectedSpot.name}`}
                accessible
                className="mt-5 h-[280px] w-full rounded-3xl"
                resizeMode="cover"
              />
            ) : (
              <View className="mt-6 h-80 items-center justify-center rounded-3xl bg-slate-100">
                <Text
                  className="font-outfit-medium text-slate-500"
                >
                  No image available
                </Text>
              </View>
            )}

            <Text
              className="font-outfit-medium mt-6 text-sm text-slate-500"
            >
              {selectedSpot.description}
            </Text>

            {selectedSpotIsOwned ? (
              <View className="mt-5 flex-row gap-3">
                <FeedbackPressable
                  haptic="light"
                  onPress={handleEditSelectedSpot}
                  disabled={deletingSpotId !== null}
                  className="h-12 flex-1 flex-row items-center justify-center rounded-2xl bg-[#21473f]"
                  accessibilityLabel={`Edit ${selectedSpot.name}`}
                  accessibilityRole="button"
                >
                  <Feather name="edit-2" size={16} color="#FFFFFF" />
                  <Text
                    className="ml-2 font-outfit-semibold text-sm text-white"
                  >
                    Edit spot
                  </Text>
                </FeedbackPressable>
                <FeedbackPressable
                  onPress={handleDeleteSelectedSpot}
                  disabled={deletingSpotId !== null}
                  className="h-12 flex-1 flex-row items-center justify-center rounded-2xl border border-[#F3B7B2] bg-[#FBE9E7]"
                  accessibilityLabel={`Delete ${selectedSpot.name}`}
                  accessibilityRole="button"
                >
                  {deletingSpotId === selectedSpot.id ? (
                    <ActivityIndicator size="small" color="#F3B7B2" />
                  ) : (
                    <Feather name="trash-2" size={16} color="#B45F58" />
                  )}
                  <Text
                    className="ml-2 font-outfit-semibold text-sm text-[#B45F58]"
                  >
                    Delete spot
                  </Text>
                </FeedbackPressable>
              </View>
            ) : null}
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
    maxHeight: '56%',
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
  toggleButton: {
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
