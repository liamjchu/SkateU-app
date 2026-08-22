import { Feather, Ionicons } from '@expo/vector-icons';
import {
    type Href,
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    FlatList,
    Image,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
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
import MapSpotSheetPage from '../components/map-spot-sheet-page';
import SpotFullscreenViewer from '../components/spot-fullscreen-viewer';
import { StickerStripe } from '../components/sticker';
import images from '../constants/images';
import { colors } from '../constants/colors';
import {
    CAMPUS_MAP_PIN_CSS,
    buildSelectSpotJavascript,
    getCampusMapPinScript,
} from '../lib/campusMapPins';
import { triggerHaptic } from '../lib/haptics';
import { sortSpotsByDistanceFrom } from '../lib/spotDistance';
import {
    getSpotSelectionStatus,
    SPOT_LOAD_FAILED_MESSAGE,
} from '../lib/spotAvailability';
import { toUserFacingError } from '../lib/userFacingError';
import { guardedNavigate } from '../lib/navigationGuard';
import { draftsForSchool } from '../lib/spotDraft';
import { useAuthStore } from '../store/authStore';
import { useBlocksStore } from '../store/blocksStore';
import { useCommentsStore } from '../store/commentsStore';
import { useDraftSpotsStore } from '../store/draftSpotsStore';
import { useFavorites } from '../store/favoritesStore';
import { useMapViewStore } from '../store/mapViewStore';
import { useSchools } from '../store/schoolsStore';
import { useSpotsStore } from '../store/spotsStore';
import type { School } from '../types/school';
import type { Spot } from '../types/spot';

const COLLAPSED_SHEET_HEIGHT = 100;
const TILE_ERROR_THRESHOLD = 3;

const MAP_ATTRIBUTIONS = {
  default: '© OpenStreetMap contributors © CARTO',
  satellite:
    'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
} as const;

const MAP_ATTRIBUTION_SHORT = {
  default: '© OpenStreetMap · CARTO',
  satellite: 'Tiles © Esri',
} as const;

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
  const userId = useAuthStore((state) => state.user?.id);
  const draftSpots = useDraftSpotsStore((state) => state.drafts);
  const spots = useSpotsStore((s) => s.spots);
  const mySpots = useSpotsStore((s) => s.mySpots);
  const myLoading = useSpotsStore((s) => s.myLoading);
  const deleteSpot = useSpotsStore((s) => s.deleteSpot);
  const toggleSpotLike = useSpotsStore((s) => s.toggleSpotLike);
  const reportedSpotIds = useSpotsStore((s) => s.reportedSpotIds);
  const fetchMySpotRemovalRequest = useSpotsStore(
    (s) => s.fetchMySpotRemovalRequest
  );
  const commentCounts = useCommentsStore((s) => s.commentCounts);
  const blockUser = useBlocksStore((s) => s.blockUser);
  const fetchMySpots = useSpotsStore((s) => s.fetchMySpots);
  const loading = useSpotsStore((s) => s.loading);
  const error = useSpotsStore((s) => s.error);
  const loadedSchoolId = useSpotsStore((s) => s.schoolId);
  const fetchSpots = useSpotsStore((s) => s.fetchSpots);
  const { schools, upsertSchool } = useSchools();
  const { favoriteSchoolIds, toggleFavoriteSchool } = useFavorites();
  const sharedMapLayer = useMapViewStore((state) => state.mapLayer);
  const setSharedMapLayer = useMapViewStore((state) => state.setMapLayer);
  const webViewReadyRef = useRef(false);
  const tileErrorCountRef = useRef(0);
  const hasInitializedMapLayerRef = useRef(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mapError, setMapError] = useState('');
  const [selectedSpotId, setSelectedSpotId] = useState<string | undefined>(
    undefined
  );
  // Recenter only when arriving from another screen with a spot selected.
  // Pin taps and sheet/fullscreen paging leave the camera alone — Leaflet
  // WebView pans are jumpy, and the selected pin already pops in place.
  const selectionSourceRef = useRef<'navigation' | 'map'>(
    initialSpotId ? 'navigation' : 'map'
  );
  const initialMapLayer: 'default' | 'satellite' =
    searchParams.layer === 'satellite' || searchParams.layer === 'default'
      ? searchParams.layer
      : sharedMapLayer;
  const [mapLayer, setMapLayer] = useState<'default' | 'satellite'>(
    initialMapLayer
  );
  const [showAttribution, setShowAttribution] = useState(false);
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  const [loginRequiredReason, setLoginRequiredReason] = useState<
    'default' | 'removal' | 'spot_problem' | 'block'
  >('default');
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenPhotoIndex, setFullscreenPhotoIndex] = useState(0);
  const [fullscreenSpots, setFullscreenSpots] = useState<Spot[]>([]);
  const [fullscreenOriginId, setFullscreenOriginId] = useState<string | undefined>(
    undefined
  );
  const [commentsCoveringViewer, setCommentsCoveringViewer] = useState(false);
  const [sheetSpots, setSheetSpots] = useState<Spot[]>([]);
  const [sheetOriginId, setSheetOriginId] = useState<string | undefined>(
    undefined
  );
  const [sheetPagerEnabled, setSheetPagerEnabled] = useState(true);
  const sheetListRef = useRef<FlatList<Spot>>(null);
  const didSelectInitialSpotRef = useRef(false);
  const [likingSpotId, setLikingSpotId] = useState<string | null>(null);
  const [deletingSpotId, setDeletingSpotId] = useState<string | null>(null);
  const missingSpotAlertedRef = useRef<string | undefined>(undefined);
  const [emptySpotsNoticeDismissed, setEmptySpotsNoticeDismissed] =
    useState(false);
  const sheetHeight = useSharedValue(0);
  const sheetTranslateY = useSharedValue(0);
  const sheetStartY = useSharedValue(0);
  const [sheetLayoutHeight, setSheetLayoutHeight] = useState(0);

  useEffect(() => {
    if (!hasInitializedMapLayerRef.current) {
      hasInitializedMapLayerRef.current = true;
      setSharedMapLayer(initialMapLayer);
      return;
    }

    if (sharedMapLayer === mapLayer) {
      return;
    }

    setMapLayer(sharedMapLayer);
    if (webViewReadyRef.current) {
      webViewRef.current?.injectJavaScript(
        `window.setMapLayer('${sharedMapLayer}'); true;`
      );
    }
  }, [initialMapLayer, mapLayer, setSharedMapLayer, sharedMapLayer]);

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
  const campusDrafts = useMemo(() => {
    if (!userId || !schoolId) {
      return [];
    }

    return draftsForSchool(draftSpots, userId, schoolId);
  }, [draftSpots, schoolId, userId]);
  const ownedSpotIds = useMemo(
    () => mySpots.map((spot) => spot.id),
    [mySpots]
  );
  const viewerSpots = useMemo(() => {
    const byId = new Map(spots.map((spot) => [spot.id, spot]));
    return fullscreenSpots
      .map((spot) => byId.get(spot.id))
      .filter((spot): spot is Spot => Boolean(spot))
      .map((spot) => ({
        ...spot,
        commentCount: commentCounts[spot.id] ?? spot.commentCount,
      }));
  }, [commentCounts, fullscreenSpots, spots]);
  const liveSheetSpots = useMemo(() => {
    const byId = new Map(spots.map((spot) => [spot.id, spot]));
    return sheetSpots
      .map((spot) => byId.get(spot.id))
      .filter((spot): spot is Spot => Boolean(spot))
      .map((spot) => ({
        ...spot,
        commentCount: commentCounts[spot.id] ?? spot.commentCount,
      }));
  }, [commentCounts, sheetSpots, spots]);
  const sheetWidth = isTabletLayout ? tabletSheetWidth : width;
  const sheetBodyHeight = Math.round(height * (isTabletLayout ? 0.5 : 0.56));

  const htmlMapLayerRef = useRef<'default' | 'satellite'>(initialMapLayer);

  const html = useMemo(() => {
    const htmlMapLayer = htmlMapLayerRef.current;

    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
    <style>
      /* FIXED: Changed 100vh/100vw to 100%. WebViews often collapse vh/vw units to 0 */
      html, body { margin: 0; padding: 0; background: ${colors.brand}; width: 100%; height: 100%; }
      #map { height: 100%; width: 100%; }
      .leaflet-popup-content-wrapper { background: ${colors.brand}; color: white; border-radius: 12px; }
      .leaflet-popup-tip { background: ${colors.brand}; }
      .leaflet-control-attribution { display: none; }

      /*brightness of the map, darken it so the pin can show*/
      #map:not(.satellite) .leaflet-tile {
        filter: brightness(.9);
      }
      #map.satellite .leaflet-tile {
        filter: brightness(.8);
      }
      ${CAMPUS_MAP_PIN_CSS}
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
        const pinSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12z" fill="${colors.accent}" stroke="${colors.brand}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.5" fill="${colors.white}"/></svg>');
        const spotIcon = L.divIcon({
          className: 'skateu-pin',
          iconSize: [50, 50],
          iconAnchor: [25, 50],
          html: '<img class="skateu-pin-shadow" alt="" width="41" height="41" src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png" /><span class="skateu-pin-scale"><img class="skateu-pin-img" alt="" width="50" height="50" src="' + pinSvg + '" /></span>',
        });

        window.map = L.map('map', {
          zoomControl: false,
          attributionControl: false,
        }).setView(center, 15.5);
        const defaultLayer = L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          { attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }
        );
        const satelliteLayer = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png',
          { attribution: 'Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community' }
        );
        const reportTileError = function () {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'TILE_ERROR',
              message: 'Map tiles could not be loaded.'
            }));
          }
        };
        defaultLayer.on('tileerror', reportTileError);
        satelliteLayer.on('tileerror', reportTileError);

        const selectedLayer = '${htmlMapLayer}' === 'satellite'
          ? satelliteLayer
          : defaultLayer;
        window.currentLayer = selectedLayer.addTo(window.map);
        document.getElementById('map').classList.toggle(
          'satellite',
          '${htmlMapLayer}' === 'satellite'
        );

        const campusCenter = L.latLng(${validLat}, ${validLng});
        window.recenterMap = function () {
          if (!window.map) return;
          window.map.setView(campusCenter, window.map.getZoom(), { animate: true });
        };

        window.focusLatLng = function (lat, lng, bottomPadding, topPadding) {
          if (!window.map) return;
          const target = L.latLng(lat, lng);
          const zoom = window.map.getZoom();
          const size = window.map.getSize();
          const top = Number(topPadding) || 0;
          const bottom = Number(bottomPadding) || 0;
          const visibleMidY = top + Math.max(size.y - top - bottom, 0) / 2;
          const targetPoint = window.map.project(target, zoom);
          const desiredCenter = window.map.unproject(
            L.point(
              targetPoint.x,
              targetPoint.y - (visibleMidY - size.y / 2)
            ),
            zoom
          );
          window.map.setView(desiredCenter, zoom, { animate: false });
        };

        window.setMapLayer = function (layer) {
          if (!window.map || (layer !== 'default' && layer !== 'satellite')) return;

          const center = window.map.getCenter();
          const zoom = window.map.getZoom();

          if (layer === 'satellite' && window.currentLayer === defaultLayer) {
            window.map.removeLayer(defaultLayer);
            satelliteLayer.addTo(window.map);
            window.currentLayer = satelliteLayer;
            document.getElementById('map').classList.add('satellite');
          } else if (layer === 'default' && window.currentLayer === satelliteLayer) {
            window.map.removeLayer(satelliteLayer);
            defaultLayer.addTo(window.map);
            window.currentLayer = defaultLayer;
            document.getElementById('map').classList.remove('satellite');
          }

          window.map.setView(center, zoom, { animate: false });

          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'LAYER_TOGGLED',
              layer: window.currentLayer === satelliteLayer ? 'satellite' : 'default',
            }));
          }
        };

        window.toggleLayer = function () {
          if (!window.map) return;
          window.setMapLayer(
            window.currentLayer === defaultLayer ? 'satellite' : 'default'
          );
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
        ${getCampusMapPinScript()}

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
          if (window.resetPinAnimations) {
            window.resetPinAnimations();
          }
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

          if (window.selectedSpotId && window.selectSpot) {
            window.selectSpot(window.selectedSpotId, { pop: false });
          }
        };

        if (${initialSpotId ? 'true' : 'false'}) {
          window.focusLatLng(
            ${validLat},
            ${validLng},
            Math.round((window.innerHeight || 0) * 0.56) + 16,
            ${insets.top + 81}
          );
        }

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
  }, [initialSpotId, insets.top, mapAttempt, validLat, validLng]);

  const webViewSource = useMemo(
    () => ({ html, baseUrl: 'https://localhost' }),
    [html]
  );

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

  useEffect(() => {
    if (mapStatus !== 'ready' || !webViewReadyRef.current) {
      return;
    }

    webViewRef.current?.injectJavaScript(buildSelectSpotJavascript(selectedSpotId));
  }, [mapStatus, selectedSpotId]);

  // Refetch when the screen regains focus so a spot just created on the
  // add-spot screen shows up on return.
  useFocusEffect(
    useCallback(() => {
      setEmptySpotsNoticeDismissed(false);
      setCommentsCoveringViewer(false);
    }, [schoolId])
  );

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
    const accessToken = session?.access_token;
    const spotId = selectedSpot?.id;
    if (!accessToken || !spotId || selectedSpotIsOwned || myLoading) {
      return;
    }

    void fetchMySpotRemovalRequest(spotId, accessToken).catch(() => {
      // Already-submitted state is a convenience; the POST unique check is the source of truth.
    });
  }, [
    fetchMySpotRemovalRequest,
    myLoading,
    selectedSpot?.id,
    selectedSpotIsOwned,
    session?.access_token,
  ]);

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
    if (!initialSpotId || didSelectInitialSpotRef.current) {
      return;
    }
    if (loadedSchoolId !== schoolId) {
      return;
    }

    const spot = spots.find((item) => item.id === initialSpotId);
    if (!spot) {
      return;
    }

    didSelectInitialSpotRef.current = true;
    selectionSourceRef.current = 'navigation';
    setSheetSpots(sortSpotsByDistanceFrom(spots, spot));
    setSheetOriginId(spot.id);
    setSelectedSpotId(spot.id);
  }, [initialSpotId, loadedSchoolId, schoolId, spots]);

  const retryMap = useCallback(() => {
    htmlMapLayerRef.current = mapLayer;
    webViewReadyRef.current = false;
    tileErrorCountRef.current = 0;
    setMapError('');
    setMapStatus('loading');
    setMapAttempt((attempt) => attempt + 1);
  }, [mapLayer]);

  const retrySpots = useCallback(() => {
    missingSpotAlertedRef.current = undefined;
    didSelectInitialSpotRef.current = false;
    if (schoolId) {
      fetchSpots(schoolId, session?.access_token);
    }
  }, [fetchSpots, schoolId, session?.access_token]);

  useEffect(() => {
    const requestedSpot = spots.find((item) => item.id === initialSpotId);
    const status = getSpotSelectionStatus({
      requestedSpotId: initialSpotId,
      selectedSpot: requestedSpot,
      loading,
      loadedSchoolId,
      routeSchoolId: schoolId,
      error,
    });

    if (
      (status === 'missing' || status === 'failed') &&
      initialSpotId &&
      missingSpotAlertedRef.current !== initialSpotId
    ) {
      missingSpotAlertedRef.current = initialSpotId;
      Alert.alert(SPOT_LOAD_FAILED_MESSAGE);
    }
  }, [error, initialSpotId, loadedSchoolId, loading, schoolId, spots]);

  useEffect(() => {
    if (!selectedSpotId || selectedSpot) {
      return;
    }
    if (loading || loadedSchoolId !== schoolId) {
      return;
    }

    setSelectedSpotId(undefined);
    setSheetSpots([]);
    setSheetOriginId(undefined);
  }, [loadedSchoolId, loading, schoolId, selectedSpot, selectedSpotId]);

  useEffect(() => {
    if (!selectedSpot) {
      setFullscreenOpen(false);
    }
  }, [selectedSpot]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (fullscreenOpen) {
          setFullscreenOpen(false);
          return true;
        }

        if (!selectedSpotId) {
          return false;
        }

        setSelectedSpotId(undefined);
        setSheetSpots([]);
        setSheetOriginId(undefined);
        return true;
      }
    );

    return () => subscription.remove();
  }, [fullscreenOpen, selectedSpotId]);

  useEffect(() => {
    if (selectedSpot) {
      sheetTranslateY.value = 0;
      sheetStartY.value = 0;
    } else {
      setSheetLayoutHeight(0);
    }
  }, [selectedSpot, sheetStartY, sheetTranslateY]);

  useEffect(() => {
    if (!selectedSpot || mapStatus !== 'ready') {
      return;
    }

    if (selectionSourceRef.current !== 'navigation') {
      return;
    }

    const topPadding = insets.top + 81;
    const sheetCover =
      (sheetLayoutHeight > 0 ? sheetLayoutHeight : Math.round(height * 0.56)) + 16;
    webViewRef.current?.injectJavaScript(
      `window.focusLatLng(${selectedSpot.latitude},${selectedSpot.longitude},${sheetCover},${topPadding}); true;`
    );
  }, [
    height,
    insets.top,
    mapStatus,
    selectedSpot?.id,
    selectedSpot?.latitude,
    selectedSpot?.longitude,
    sheetLayoutHeight,
  ]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const sheetPanGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      sheetStartY.value = sheetTranslateY.value;
    })
    .onUpdate((event) => {
      'worklet';
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
      'worklet';
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
      setLoginRequiredReason('default');
      setShowLoginRequired(true);
      return;
    }

    setSelectedSpotId(undefined);
    setSheetSpots([]);
    setSheetOriginId(undefined);
    webViewRef.current?.injectJavaScript(`window.sendCenter(); true;`);
  };

  const handleDraftsChipPress = () => {
    if (campusDrafts.length === 1) {
      const draft = campusDrafts[0];
      guardedNavigate(`add-spot-draft:${draft.id}`, () => {
        router.push({
          pathname: '/add-spot',
          params: {
            draftId: draft.id,
            schoolId: draft.schoolId,
            schoolName: draft.schoolName,
            lat: draft.latitude.toString(),
            lng: draft.longitude.toString(),
            layer: mapLayer,
          },
        });
      });
      return;
    }

    guardedNavigate('profile-drafts', () => {
      router.push('/profile?tab=drafts');
    });
  };

  const openSheetForSpot = (spot: Spot, source: 'map' | 'navigation') => {
    selectionSourceRef.current = source;
    setSheetSpots(sortSpotsByDistanceFrom(spots, spot));
    setSheetOriginId(spot.id);
    setSelectedSpotId(spot.id);
    sheetTranslateY.value = 0;
    sheetStartY.value = 0;
  };

  const clearSelectedSpot = () => {
    setSelectedSpotId(undefined);
    setSheetSpots([]);
    setSheetOriginId(undefined);
  };

  const goToSheetIndex = (index: number) => {
    if (index < 0 || index >= liveSheetSpots.length) {
      return;
    }

    const spot = liveSheetSpots[index];
    if (!spot) {
      return;
    }

    setSheetPagerEnabled(true);
    sheetListRef.current?.scrollToIndex({ index, animated: true });
    selectionSourceRef.current = 'map';
    setSelectedSpotId(spot.id);
    sheetTranslateY.value = withTiming(0, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
    });
    triggerHaptic('selection');
  };

  const handleSheetScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / sheetWidth);
    const spot = liveSheetSpots[next];
    if (!spot || spot.id === selectedSpotId) {
      return;
    }

    selectionSourceRef.current = 'map';
    setSelectedSpotId(spot.id);
    sheetTranslateY.value = withTiming(0, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
    });
    triggerHaptic('selection');
  };

  const openFullscreen = (photoIndex = 0) => {
    if (!selectedSpot) {
      return;
    }

    setFullscreenSpots(sortSpotsByDistanceFrom(spots, selectedSpot));
    setFullscreenOriginId(selectedSpot.id);
    setFullscreenPhotoIndex(photoIndex);
    setFullscreenOpen(true);
  };

  const handleFullscreenSpotChange = (spot: Spot) => {
    selectionSourceRef.current = 'map';
    setSelectedSpotId(spot.id);
  };

  const handleLikePress = async (spot?: Spot) => {
    const target = spot ?? selectedSpot;
    if (!target) {
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setLoginRequiredReason('default');
      setShowLoginRequired(true);
      return;
    }

    if (likingSpotId) {
      return;
    }

    setLikingSpotId(target.id);
    try {
      await toggleSpotLike(
        target.id,
        target.likedByUser === true,
        accessToken
      );
      triggerHaptic('light');
    } catch (error) {
      Alert.alert(
        'Couldn’t update that like',
        toUserFacingError(error, 'Please try again.')
      );
    } finally {
      setLikingSpotId(null);
    }
  };

  const handleOpenComments = (spot?: Spot) => {
    const target = spot ?? selectedSpot;
    if (!target) {
      return;
    }

    if (fullscreenOpen) {
      setCommentsCoveringViewer(true);
    }
    guardedNavigate(`comments:${target.id}`, () => {
      router.push({
        pathname: '/spot-comments',
        params: { spotId: target.id, spotName: target.name },
      });
    });
  };

  const handleReportProblemPress = (spot?: Spot) => {
    const target = spot ?? selectedSpot;
    if (!target || ownedSpotIds.includes(target.id)) {
      return;
    }

    if (!session?.access_token) {
      setLoginRequiredReason('spot_problem');
      setShowLoginRequired(true);
      return;
    }

    setFullscreenOpen(false);
    guardedNavigate(`spot-problem:${target.id}`, () => {
      router.push({
        pathname: '/help/spot-problem',
        params: { spotId: target.id, spotName: target.name },
      });
    });
  };

  const handleRequestRemovalPress = (spot?: Spot) => {
    const target = spot ?? selectedSpot;
    if (!target || ownedSpotIds.includes(target.id)) {
      return;
    }

    if (!session?.access_token) {
      setLoginRequiredReason('removal');
      setShowLoginRequired(true);
      return;
    }

    setFullscreenOpen(false);
    guardedNavigate(`spot-removal:${target.id}`, () => {
      router.push(
        `/request-spot-removal?spotId=${encodeURIComponent(target.id)}&spotName=${encodeURIComponent(target.name)}` as Href
      );
    });
  };

  const handleBlockCreatorPress = (spot?: Spot) => {
    const target = spot ?? selectedSpot;
    const blockedId = target?.creatorUserId;
    if (!target || ownedSpotIds.includes(target.id) || !blockedId) {
      return;
    }

    if (!session?.access_token) {
      setLoginRequiredReason('block');
      setShowLoginRequired(true);
      return;
    }

    const accessToken = session.access_token;
    const label = target.creatorUsername
      ? `@${target.creatorUsername}`
      : 'this skater';
    Alert.alert(
      `Block ${label}?`,
      'You won’t see their spots or comments. You can unblock them in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            void blockUser(blockedId, accessToken, target.creatorUsername)
              .then(() => {
                triggerHaptic('success');
                if (selectedSpotId === target.id) {
                  setSelectedSpotId(undefined);
                }
              })
              .catch((caught: unknown) => {
                Alert.alert(
                  'Couldn’t block that skater',
                  toUserFacingError(caught, 'Please try again.')
                );
              });
          },
        },
      ]
    );
  };

  const handleEditSelectedSpot = (spot?: Spot) => {
    const target = spot ?? selectedSpot;
    if (!target || !ownedSpotIds.includes(target.id) || deletingSpotId) {
      return;
    }

    setFullscreenOpen(false);
    guardedNavigate(`edit-spot:${target.id}`, () => {
      router.push(
        `/edit-spot?id=${encodeURIComponent(target.id)}&layer=${mapLayer}`
      );
    });
  };

  const handleDeleteSelectedSpot = (spot?: Spot) => {
    const target = spot ?? selectedSpot;
    if (!target || !ownedSpotIds.includes(target.id) || deletingSpotId) {
      return;
    }

    triggerHaptic('warning');
    const spotToDelete = target;
    Alert.alert(
      'Delete this spot?',
      `"${spotToDelete.name}" will be gone for everyone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const accessToken = session?.access_token;
            if (!accessToken) {
              Alert.alert('Sign in to delete a spot.');
              return;
            }

            setDeletingSpotId(spotToDelete.id);

            try {
              await deleteSpot(spotToDelete.id, accessToken);
              setFullscreenOpen(false);
              setSelectedSpotId(undefined);
              setSheetSpots([]);
              setSheetOriginId(undefined);
            } catch (error) {
              Alert.alert(
                'Couldn’t delete that spot',
                toUserFacingError(error, 'Please try again.')
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
        tileErrorCountRef.current = 0;
        webViewReadyRef.current = true;
        setMapStatus('ready');
        setMapError('');
        sendMarkers();
        return;
      }

      if (data.type === 'TILE_ERROR') {
        tileErrorCountRef.current += 1;
        if (tileErrorCountRef.current < TILE_ERROR_THRESHOLD) {
          return;
        }

        webViewReadyRef.current = false;
        setMapStatus('error');
        setMapError('Couldn’t load map tiles.');
        return;
      }

      if (data.type === 'CONSOLE_ERROR') {
        webViewReadyRef.current = false;
        setMapStatus('error');
        setMapError(
          data.message && data.message.length > 0
            ? data.message
            : 'Couldn’t start the campus map.'
        );
        return;
      }

      if (data.type === 'LAYER_TOGGLED') {
        const layer = data.layer === 'satellite' ? 'satellite' : 'default';
        setMapLayer(layer);
        setSharedMapLayer(layer);
        return;
      }

      if (data.type === 'CURRENT_CENTER' && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const layer = data.layer === 'satellite' ? 'satellite' : 'default';
        const params = new URLSearchParams();
        params.set('lat', data.latitude.toString());
        params.set('lng', data.longitude.toString());
        params.set('layer', layer);
        if (schoolId) params.set('schoolId', schoolId);
        if (schoolName) params.set('schoolName', schoolName);
        guardedNavigate('add-spot', () => {
          router.push(`/add-spot?${params.toString()}`);
        });
        return;
      }

      if (data.type === 'MARKER_PRESS' && typeof data.id === 'string') {
        triggerHaptic('selection');
        selectionSourceRef.current = 'map';
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
          setSheetSpots([]);
          setSheetOriginId(undefined);
          return;
        }

        const pressed = spots.find((spot) => spot.id === data.id);
        if (pressed) {
          openSheetForSpot(pressed, 'map');
        } else {
          setSelectedSpotId(data.id);
        }
      }
    } catch (error) {
      console.error('MapScreen message parse error', error);
    }
  };

  return (
    <View className="flex-1 bg-brand">
      <View
        className="absolute left-0 right-0 z-50 bg-brand"
        style={{
          top: 0,
          height: insets.top + 81,
          paddingTop: insets.top,
        }}
      >
        <View className="flex-1 flex-row items-center justify-between px-5">
        <FeedbackPressable
          haptic="light"
          onPress={handleBackPress}
          className="h-12 w-12 items-center justify-center rounded-full"
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Feather name="chevron-left" size={28} color="#FFFFFF" />
        </FeedbackPressable>

        <View
          pointerEvents="none"
          className="absolute inset-y-0 left-0 right-0 items-center justify-center px-20"
        >
          <Text
            className="text-center font-outfit-bold text-2xl text-white"
            numberOfLines={1}
          >
            {displayedSchoolName}
          </Text>
          {locationSubtitle && (
            <Text
              className="text-center font-outfit-medium text-sm"
              style={{ color: 'rgba(255,255,255,0.72)' }}
              numberOfLines={1}
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
              isFavoriteSchool ? 'Remove school from saved schools' : 'Save this school'
            }
            accessibilityRole="button"
          >
            <Ionicons
              name={isFavoriteSchool ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={isFavoriteSchool ? colors.accent : '#FFFFFF'}
            />
          </FeedbackPressable>
        ) : (
          <View className="h-12 w-12" />
        )}
        </View>
        <StickerStripe />
      </View>
      <View
        className="absolute left-4 z-[999] gap-2.5"
        style={{ bottom: Math.max(insets.bottom, 12) + 36 }}
        accessibilityRole="toolbar"
        accessibilityLabel="Map navigation"
      >
        <FeedbackPressable
          haptic="selection"
          onPress={() => {
            webViewRef.current?.injectJavaScript(`window.toggleLayer(); true;`);
          }}
          disabled={mapStatus !== 'ready'}
          className="h-14 w-14 items-center justify-center rounded-full bg-white"
          style={styles.mapControl}
          accessibilityLabel={
            mapLayer === 'satellite'
              ? 'Switch to standard map'
              : 'Switch to satellite map'
          }
          accessibilityRole="button"
          accessibilityState={{
            disabled: mapStatus !== 'ready',
            selected: mapLayer === 'satellite',
          }}
        >
          <Image source={images.layers} style={styles.mapControlIcon} />
        </FeedbackPressable>
        <FeedbackPressable
          haptic="light"
          onPress={() => {
            webViewRef.current?.injectJavaScript(
              `window.recenterMap(); true;`
            );
          }}
          disabled={mapStatus !== 'ready'}
          className="h-14 w-14 items-center justify-center rounded-full bg-white"
          style={styles.mapControl}
          accessibilityRole="button"
          accessibilityLabel="Recenter on campus"
          accessibilityHint="Moves the map back to the campus center"
          accessibilityState={{ disabled: mapStatus !== 'ready' }}
        >
          <Feather name="crosshair" size={26} color={colors.brand} />
        </FeedbackPressable>
      </View>
      <View
        className="absolute right-4 z-[999] items-end"
        style={{ bottom: Math.max(insets.bottom, 12) + 36 }}
      >
        {campusDrafts.length > 0 ? (
          <FeedbackPressable
            haptic="light"
            onPress={handleDraftsChipPress}
            className="mb-3 flex-row items-center rounded-full bg-white px-4 py-2.5"
            style={styles.mapControl}
            accessibilityRole="button"
            accessibilityLabel={
              campusDrafts.length === 1
                ? 'Continue campus draft'
                : `Open drafts, ${campusDrafts.length} on this campus`
            }
            accessibilityHint={
              campusDrafts.length === 1
                ? 'Opens the draft you started on this campus'
                : 'Opens your drafts list'
            }
          >
            <Feather name="edit-3" size={16} color={colors.brand} />
            <Text className="ml-2 font-outfit-bold text-sm text-brand">
              Drafts ({campusDrafts.length})
            </Text>
          </FeedbackPressable>
        ) : null}
        <FeedbackPressable
          haptic="light"
          className="h-16 w-16 items-center justify-center rounded-full bg-accent"
          style={styles.fab}
          onPress={handleAddSpotPress}
          accessibilityLabel="Add new spot"
          accessibilityRole="button"
          accessibilityHint="Opens the form to add a skate spot"
        >
          <Feather name="plus" size={32} color={colors.brand} />
        </FeedbackPressable>
      </View>
      <FeedbackPressable
        onPress={() => setShowAttribution(true)}
        disabled={mapStatus !== 'ready'}
        className="absolute left-4 z-[998] max-w-[70%] self-start rounded-full bg-black/40 px-2.5 py-1"
        style={{ bottom: Math.max(insets.bottom, 10) }}
        accessibilityRole="button"
        accessibilityLabel="Map attribution"
        accessibilityHint="Shows full credit for the active map layer"
        accessibilityState={{ disabled: mapStatus !== 'ready' }}
      >
        <Text
          className="font-outfit-medium text-sm leading-4 text-white"
          numberOfLines={1}
        >
          {MAP_ATTRIBUTION_SHORT[mapLayer]}
        </Text>
      </FeedbackPressable>
      <LoginRequiredModal
        visible={showLoginRequired}
        onCancel={() => setShowLoginRequired(false)}
        title={
          loginRequiredReason === 'removal'
            ? 'Sign in to request removal'
            : loginRequiredReason === 'spot_problem'
              ? 'Sign in to report a problem'
              : loginRequiredReason === 'block'
                ? 'Sign in to block this skater'
                : undefined
        }
        message={
          loginRequiredReason === 'removal'
            ? 'You can still browse campuses. Sign in if you want to request that a spot be removed.'
            : loginRequiredReason === 'spot_problem'
              ? 'You can still browse campuses. Sign in if you want to report a problem with this spot.'
              : loginRequiredReason === 'block'
                ? 'You can still browse campuses. Sign in if you want to hide this skater’s spots and comments.'
                : undefined
        }
      />
      <SpotFullscreenViewer
        visible={fullscreenOpen && !commentsCoveringViewer}
        spots={viewerSpots}
        initialSpotId={fullscreenOriginId ?? selectedSpot?.id ?? ''}
        initialPhotoIndex={fullscreenPhotoIndex}
        variant="map"
        originSpotId={fullscreenOriginId}
        onClose={() => {
          setFullscreenOpen(false);
          if (selectedSpot) {
            setSheetSpots(sortSpotsByDistanceFrom(spots, selectedSpot));
            setSheetOriginId(selectedSpot.id);
          }
        }}
        onChangeSpot={handleFullscreenSpotChange}
        onLike={(spot) => {
          void handleLikePress(spot);
        }}
        onOpenComments={handleOpenComments}
        likingSpotId={likingSpotId}
        ownedSpotIds={ownedSpotIds}
        reportedSpotIds={reportedSpotIds}
        mySpotsLoading={myLoading}
        isSignedIn={Boolean(session)}
        deletingSpotId={deletingSpotId}
        onEdit={handleEditSelectedSpot}
        onDelete={handleDeleteSelectedSpot}
        onReportProblem={handleReportProblemPress}
        onRequestRemoval={handleRequestRemovalPress}
      />
      <Modal
        visible={showAttribution}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttribution(false)}
      >
        <View
          className="flex-1 justify-end bg-black/30"
          accessibilityViewIsModal
          accessibilityLabel="Map attribution"
        >
          <Pressable
            className="absolute inset-0"
            onPress={() => setShowAttribution(false)}
            accessibilityRole="button"
            accessibilityLabel="Close map attribution"
          />
          <View
            className="rounded-t-2xl bg-field px-5 pt-3"
            style={[styles.attributionSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          >
            <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-accent" />
            <View className="min-h-12 flex-row items-center justify-between">
              <Text className="font-outfit-bold text-xl text-ink">
                Map attribution
              </Text>
              <FeedbackPressable
                haptic="selection"
                onPress={() => setShowAttribution(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-surface-soft"
                accessibilityRole="button"
                accessibilityLabel="Close map attribution"
              >
                <Ionicons name="close" size={18} color={colors.muted} />
              </FeedbackPressable>
            </View>
            <View className="mt-4 pb-6">
              <Text className="font-outfit-medium text-sm leading-5 text-muted-strong">
                {MAP_ATTRIBUTIONS[mapLayer]}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
      <WebView
        accessibilityLabel={`Campus map for ${displayedSchoolName}. ${spots.length} skate ${spots.length === 1 ? 'spot' : 'spots'} available. Use the map or the accessible spot actions to select a spot.`}
        accessibilityActions={spots.map((spot) => ({
          name: `select-${spot.id}`,
          label: `Select ${spot.name}`,
        }))}
        onAccessibilityAction={(event) => {
          const spotId = event.nativeEvent.actionName.replace('select-', '');
          if (spots.some((spot) => spot.id === spotId)) {
            const pressed = spots.find((spot) => spot.id === spotId);
            if (pressed) {
              openSheetForSpot(pressed, 'map');
            }
          }
        }}
        key={mapAttempt}
        ref={webViewRef}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        originWhitelist={['*']}
        source={webViewSource}
        // Explicitly enable JS and DOM Storage (critical for map libraries)
        javaScriptEnabled={true}
        domStorageEnabled={true}
        // Allow mixed content so HTTPS tiles can load over the base URL
        mixedContentMode="always"
        onLoadStart={() => {
          webViewReadyRef.current = false;
          tileErrorCountRef.current = 0;
          setMapStatus('loading');
          setMapError('');
        }}
        onError={() => {
          webViewReadyRef.current = false;
          setMapStatus('error');
          setMapError('Couldn’t load the campus map.');
        }}
        onHttpError={() => {
          webViewReadyRef.current = false;
          setMapStatus('error');
          setMapError('Couldn’t load the campus map.');
        }}
        onMessage={handleWebViewMessage}
      />

      {mapStatus === 'loading' ? (
        <View
          className="absolute inset-0 z-40 items-center justify-center bg-brand/90 px-8"
          style={{ top: insets.top + 80 }}
        >
          <ActivityIndicator color="#FFFFFF" />
          <Text className="mt-3 text-center font-outfit-medium text-base text-white">
            Loading campus map…
          </Text>
        </View>
      ) : mapStatus === 'error' ? (
        <View
          className="absolute inset-0 z-40 items-center justify-center bg-brand/95 px-8"
          accessibilityLabel={`Map unavailable. ${mapError || 'Check your connection and try again.'}`}
        >
          <Text className="text-center font-outfit-bold text-xl text-white">
            Map unavailable
          </Text>
          <Text className="mt-2 text-center font-outfit-medium text-base text-white">
            Check your connection and try again.
          </Text>
          <FeedbackPressable
            onPress={retryMap}
            className="mt-5 rounded-2xl bg-accent px-6 py-3"
            accessibilityRole="button"
            accessibilityLabel="Retry loading campus map"
          >
            <Text className="font-outfit-bold text-base text-brand">Retry</Text>
          </FeedbackPressable>
        </View>
      ) : null}

      {mapStatus === 'ready' && error ? (
        <View
          className="absolute left-4 right-4 z-40 rounded-2xl border border-errorBorder bg-field px-4 py-3"
          style={{ top: insets.top + 88 }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="font-outfit-bold text-sm text-errorText"
              >
                Spots unavailable
              </Text>
              <Text className="mt-0.5 font-outfit-medium text-xs text-muted-strong">
                Map’s up, but spots didn’t load.
              </Text>
            </View>
            <FeedbackPressable
              onPress={retrySpots}
              className="rounded-xl bg-accent px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="Retry loading skate spots"
            >
              <Text className="font-outfit-bold text-xs text-brand">Retry</Text>
            </FeedbackPressable>
          </View>
        </View>
      ) : mapStatus === 'ready' && loading ? (
        <View
          className="absolute left-0 right-0 z-40 items-center"
          style={{ top: insets.top + 96 }}
        >
          <View className="flex-row items-center rounded-full bg-white px-3 py-1.5">
            <ActivityIndicator size="small" color={colors.brand} />
            <Text className="ml-2 font-outfit-medium text-xs text-brand">
              Loading spots…
            </Text>
          </View>
        </View>
      ) : null}

      {mapStatus === 'ready' &&
      !loading &&
      !error &&
      spots.length === 0 &&
      !emptySpotsNoticeDismissed ? (
        <View className="absolute left-6 right-6 top-1/2 z-30 -translate-y-1/2 items-center rounded-2xl bg-field px-6 py-6">
            <FeedbackPressable
              haptic="selection"
              onPress={() => setEmptySpotsNoticeDismissed(true)}
              className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-full bg-surface-soft"
              accessibilityRole="button"
              accessibilityLabel="Dismiss empty campus message"
              accessibilityHint="Hides this message so you can move around the map"
            >
              <Ionicons name="close" size={18} color={colors.muted} />
            </FeedbackPressable>
            <Feather name="map-pin" size={28} color={colors.accent} />
            <Text className="mt-3 text-center font-outfit-bold text-xl text-ink">
              No skate spots here yet
            </Text>
            <Text className="mt-1.5 text-center font-outfit-medium text-sm leading-5 text-muted-strong">
              Be the first to drop a spot on this campus.
            </Text>
            <FeedbackPressable
              onPress={handleAddSpotPress}
              className="mt-5 rounded-2xl bg-accent px-5 py-3"
              accessibilityRole="button"
              accessibilityLabel="Add the first spot"
            >
              <Text className="font-outfit-bold text-base text-brand">Add the first spot</Text>
            </FeedbackPressable>
        </View>
      ) : null}

      {selectedSpot && liveSheetSpots.length > 0 ? (
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={`${selectedSpot.name} spot details`}
          entering={SlideInDown.duration(240)}
          exiting={SlideOutDown.duration(220)}
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            sheetHeight.value = nextHeight;
            setSheetLayoutHeight(nextHeight);
          }}
          style={[
            styles.sheet,
            isTabletLayout && {
              left: 24,
              right: undefined,
              width: tabletSheetWidth,
            },
            {
              ...(liveSheetSpots.length > 1
                ? { height: sheetBodyHeight }
                : { maxHeight: sheetBodyHeight }),
              paddingBottom: Math.max(insets.bottom, 16),
            },
            sheetAnimatedStyle,
          ]}
        >
          <GestureDetector gesture={sheetPanGesture}>
            <View className={liveSheetSpots.length > 1 ? 'mb-2' : 'mb-3'}>
              {liveSheetSpots.length > 1 ? (
                <>
                  <View className="h-1.5 w-12 self-center rounded-full bg-accent" />
                  <View className="mt-3 flex-row items-center px-5">
                  <FeedbackPressable
                    haptic="selection"
                    onPress={() =>
                      goToSheetIndex(
                        Math.max(
                          0,
                          liveSheetSpots.findIndex(
                            (item) => item.id === selectedSpot.id
                          ) - 1
                        )
                      )
                    }
                    disabled={selectedSpot.id === liveSheetSpots[0]?.id}
                    className="h-9 w-9 items-center justify-center rounded-full bg-surface-soft"
                    accessibilityRole="button"
                    accessibilityLabel="Previous nearby spot"
                  >
                    <Feather
                      name="chevron-left"
                      size={18}
                      color={
                        selectedSpot.id === liveSheetSpots[0]?.id
                          ? colors.mutedSoft
                          : colors.ink
                      }
                    />
                  </FeedbackPressable>
                  <Text
                    className="min-w-0 flex-1 text-center font-outfit-semibold text-xs text-muted"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {liveSheetSpots.findIndex(
                      (item) => item.id === selectedSpot.id
                    ) + 1}{' '}
                    of {liveSheetSpots.length} nearby
                  </Text>
                  <FeedbackPressable
                    haptic="selection"
                    onPress={() =>
                      goToSheetIndex(
                        Math.min(
                          liveSheetSpots.length - 1,
                          liveSheetSpots.findIndex(
                            (item) => item.id === selectedSpot.id
                          ) + 1
                        )
                      )
                    }
                    disabled={
                      selectedSpot.id ===
                      liveSheetSpots[liveSheetSpots.length - 1]?.id
                    }
                    className="mr-2 h-9 w-9 items-center justify-center rounded-full bg-surface-soft"
                    accessibilityRole="button"
                    accessibilityLabel="Next nearby spot"
                  >
                    <Feather
                      name="chevron-right"
                      size={18}
                      color={
                        selectedSpot.id ===
                        liveSheetSpots[liveSheetSpots.length - 1]?.id
                          ? colors.mutedSoft
                          : colors.ink
                      }
                    />
                  </FeedbackPressable>
                  <FeedbackPressable
                    haptic="selection"
                    onPress={clearSelectedSpot}
                    className="h-10 w-10 items-center justify-center rounded-full bg-surface-soft"
                    accessibilityRole="button"
                    accessibilityLabel={`Close ${selectedSpot.name} details`}
                  >
                    <Ionicons name="close" size={18} color={colors.muted} />
                  </FeedbackPressable>
                </View>
                </>
              ) : (
                <View className="h-10 justify-center">
                  <View className="h-1.5 w-12 self-center rounded-full bg-accent" />
                  <FeedbackPressable
                    haptic="selection"
                    onPress={clearSelectedSpot}
                    className="absolute right-5 top-0 h-10 w-10 items-center justify-center rounded-full bg-surface-soft"
                    accessibilityRole="button"
                    accessibilityLabel={`Close ${selectedSpot.name} details`}
                  >
                    <Ionicons name="close" size={18} color={colors.muted} />
                  </FeedbackPressable>
                </View>
              )}
            </View>
          </GestureDetector>

          {liveSheetSpots.length > 1 ? (
          <FlatList
            ref={sheetListRef}
            style={{ flex: 1 }}
            data={liveSheetSpots}
            key={sheetOriginId ?? selectedSpot.id}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            directionalLockEnabled
            scrollEnabled={sheetPagerEnabled}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_data, index) => ({
              length: sheetWidth,
              offset: sheetWidth * index,
              index,
            })}
            onMomentumScrollEnd={handleSheetScrollEnd}
            extraData={{
              likingSpotId,
              selectedSpotId,
              deletingSpotId,
              commentCounts,
            }}
            renderItem={({ item }) => (
              <MapSpotSheetPage
                spot={item}
                width={sheetWidth}
                likingSpotId={likingSpotId}
                commentCount={
                  commentCounts[item.id] ?? item.commentCount ?? 0
                }
                isOwned={ownedSpotIds.includes(item.id)}
                wasReported={reportedSpotIds.includes(item.id)}
                canShowRemoval={
                  !ownedSpotIds.includes(item.id) &&
                  (!session || !myLoading)
                }
                deletingSpotId={deletingSpotId}
                onOpenFullscreen={openFullscreen}
                onLike={() => {
                  void handleLikePress(item);
                }}
                onOpenComments={() => handleOpenComments(item)}
                onEdit={() => handleEditSelectedSpot(item)}
                onDelete={() => handleDeleteSelectedSpot(item)}
                onReportProblem={() => handleReportProblemPress(item)}
                onRequestRemoval={() => handleRequestRemovalPress(item)}
                onBlockCreator={() => handleBlockCreatorPress(item)}
                onPhotoZoneTouch={() => setSheetPagerEnabled(false)}
                onDetailsZoneTouch={() => setSheetPagerEnabled(true)}
              />
            )}
          />
          ) : (
            <ScrollView
              style={{ flexGrow: 0, flexShrink: 1 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              directionalLockEnabled
              keyboardShouldPersistTaps="handled"
            >
              <MapSpotSheetPage
                spot={selectedSpot}
                width={sheetWidth}
                fill={false}
                likingSpotId={likingSpotId}
                commentCount={
                  commentCounts[selectedSpot.id] ??
                  selectedSpot.commentCount ??
                  0
                }
                isOwned={ownedSpotIds.includes(selectedSpot.id)}
                wasReported={reportedSpotIds.includes(selectedSpot.id)}
                canShowRemoval={
                  !ownedSpotIds.includes(selectedSpot.id) &&
                  (!session || !myLoading)
                }
                deletingSpotId={deletingSpotId}
                onOpenFullscreen={openFullscreen}
                onLike={() => {
                  void handleLikePress(selectedSpot);
                }}
                onOpenComments={() => handleOpenComments(selectedSpot)}
                onEdit={() => handleEditSelectedSpot(selectedSpot)}
                onDelete={() => handleDeleteSelectedSpot(selectedSpot)}
                onReportProblem={() =>
                  handleReportProblemPress(selectedSpot)
                }
                onRequestRemoval={() =>
                  handleRequestRemovalPress(selectedSpot)
                }
                onBlockCreator={() => handleBlockCreatorPress(selectedSpot)}
                onPhotoZoneTouch={() => setSheetPagerEnabled(false)}
                onDetailsZoneTouch={() => setSheetPagerEnabled(true)}
              />
            </ScrollView>
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  attributionSheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.field,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
  mapControl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 6,
  },
  mapControlIcon: {
    width: 26,
    height: 26,
    tintColor: colors.brand,
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 8,
  },
});
