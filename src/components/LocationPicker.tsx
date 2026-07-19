import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import images from '../constants/images';
import { useMapViewStore, type MapLayer } from '../store/mapViewStore';
import FeedbackPressable from './FeedbackPressable';

export type LayerType = MapLayer;

type LocationPickerProps = {
  initialLatitude: number;
  initialLongitude: number;
  initialLayer: LayerType;
  onLocationChange: (latitude: number, longitude: number) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
};

export default function LocationPicker({
  initialLatitude,
  initialLongitude,
  initialLayer,
  onLocationChange,
  onInteractionChange,
}: LocationPickerProps) {
  const { height, width } = useWindowDimensions();
  const isTabletLayout = width >= 768 && height >= 600;
  const webViewRef = useRef<WebView>(null);
  const setMapViewLayer = useMapViewStore((state) => state.setMapLayer);
  const [mapLayer, setMapLayer] = useState<LayerType>(initialLayer);
  const [webViewAttempt, setWebViewAttempt] = useState(0);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mapError, setMapError] = useState('');

  const initialRef = useRef({
    latitude: initialLatitude,
    longitude: initialLongitude,
    layer: initialLayer,
  });

  const [selectedLatitude, setSelectedLatitude] =
    useState<number>(initialLatitude);

  const [selectedLongitude, setSelectedLongitude] =
    useState<number>(initialLongitude);

  useEffect(() => {
    onLocationChange(selectedLatitude, selectedLongitude);
  }, [selectedLatitude, selectedLongitude, onLocationChange]);

  const html = useMemo(() => {
    const { latitude, longitude, layer } = initialRef.current;

    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #0b0f14;
      }

      #map {
        height: 100%;
        width: 100%;
      }

      .leaflet-control-attribution {
        display: none;
      }

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
      function postMessage(message) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      }

      window.onerror = function(message, source, lineno) {
        postMessage({ type: 'CONSOLE_ERROR', message: String(message) + ' at line ' + lineno });
        return true;
      };

      try {
        const center = [${latitude}, ${longitude}];

        window.map = L.map('map', {
          zoomControl: false,
        }).setView(center, 15.5);

        const defaultUrl =
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

        const satelliteUrl =
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png';

        const defaultLayer = L.tileLayer(defaultUrl);
        const satelliteLayer = L.tileLayer(satelliteUrl);
        const reportTileError = function () {
          postMessage({
            type: 'CONSOLE_ERROR',
            message: 'Map tiles could not be loaded.',
          });
        };
        defaultLayer.on('tileerror', reportTileError);
        satelliteLayer.on('tileerror', reportTileError);

        // Keep both layers mounted and fully opaque, then swap their z-index so
        // the selected one always covers the other. This avoids tile reloads
        // and lets the toggle work reliably for unlimited presses.
        defaultLayer.addTo(window.map);
        satelliteLayer.addTo(window.map);

        function showLayer(layer) {
          const showSatellite = layer === 'satellite';

          defaultLayer.setZIndex(showSatellite ? 1 : 2);
          satelliteLayer.setZIndex(showSatellite ? 2 : 1);

          window.currentLayer = showSatellite ? satelliteLayer : defaultLayer;
          document.getElementById('map').classList.toggle('satellite', showSatellite);
        }

        showLayer('${layer}');

        window.setLayer = function (layer) {
          if (!window.map || (layer !== 'default' && layer !== 'satellite')) return;

          showLayer(layer);
          postMessage({
            type: 'LAYER_TOGGLED',
            layer: layer,
          });
        };

        window.toggleLayer = function () {
          if (!window.map) return;
          window.setLayer(
            window.currentLayer === satelliteLayer ? 'default' : 'satellite'
          );
        };

        function postCenter() {
          const center = window.map.getCenter();
          postMessage({
            type: 'CENTER_CHANGED',
            latitude: center.lat,
            longitude: center.lng,
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
          message: error instanceof Error ? error.message : 'Unable to initialize the location map.',
        });
      }
    </script>
  </body>
  </html>
  `;
  }, []);

  useEffect(() => {
    if (mapStatus !== 'loading') {
      return;
    }

    const timeout = setTimeout(() => {
      setMapStatus('error');
      setMapError('The location map took too long to load.');
    }, 12_000);

    return () => clearTimeout(timeout);
  }, [mapStatus, webViewAttempt]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'WEBVIEW_READY') {
        setMapStatus('ready');
        setMapError('');
      }

      if (data.type === 'CONSOLE_ERROR') {
        setMapStatus('error');
        setMapError(
          typeof data.message === 'string' && data.message.length > 0
            ? data.message
            : 'The location map could not be loaded.'
        );
      }

      if (data.type === 'LAYER_TOGGLED') {
        const layer: LayerType =
          data.layer === 'satellite' ? 'satellite' : 'default';
        setMapLayer(layer);
        setMapViewLayer(layer);
      }

      if (
        data.type === 'CENTER_CHANGED' &&
        typeof data.latitude === 'number' &&
        typeof data.longitude === 'number'
      ) {
        setSelectedLatitude(data.latitude);
        setSelectedLongitude(data.longitude);
      }

      if (data.type === 'INTERACTION_START') {
        onInteractionChange?.(true);
      }

      if (data.type === 'INTERACTION_END') {
        onInteractionChange?.(false);
      }
    } catch (error) {
      console.error('LocationPicker message parse error', error);
    }
  };

  const retryMap = () => {
    setMapError('');
    setMapStatus('loading');
    setWebViewAttempt((attempt) => attempt + 1);
  };

  return (
    <View
      className="mb-6 overflow-hidden rounded-2xl border border-[#dce5e2] bg-[#f7f8f8]"
      accessible
      accessibilityLabel={`Location picker. Selected latitude ${selectedLatitude.toFixed(5)}, longitude ${selectedLongitude.toFixed(5)}. Drag the map to change the location.`}
    >
      <View
        className="relative bg-black"
        style={{ height: isTabletLayout ? 320 : 224 }}
      >
        <WebView
          key={webViewAttempt}
          accessibilityLabel="Interactive map. Drag to choose the spot location."
          accessible
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://localhost' }}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          onLoadStart={() => {
            setMapStatus('loading');
            setMapError('');
          }}
          onError={() => {
            setMapStatus('error');
            setMapError('The location map could not be loaded.');
          }}
          onHttpError={() => {
            setMapStatus('error');
            setMapError('The location map could not be loaded.');
          }}
          onMessage={handleMessage}
          style={{ flex: 1, backgroundColor: '#0b0f14' }}
        />

        {mapStatus === 'ready' ? (
          <FeedbackPressable
            haptic="selection"
            onPress={() => {
              webViewRef.current?.injectJavaScript(
                `window.toggleLayer(); true;`
              );
            }}
            className="absolute right-3 top-3 z-20 h-10 w-10 items-center justify-center rounded-full bg-[rgba(0,0,0,0.4)]"
            accessibilityRole="button"
            accessibilityLabel={
              mapLayer === 'satellite'
                ? 'Switch location map to standard map'
                : 'Switch location map to satellite map'
            }
            accessibilityState={{ selected: mapLayer === 'satellite' }}
          >
            <Image
              source={images.layers}
              className="h-7 w-7"
              style={{ tintColor: '#FFFFFF' }}
            />
          </FeedbackPressable>
        ) : null}

        {mapStatus !== 'ready' ? (
          <View
            className="absolute inset-0 items-center justify-center bg-[#0b0f14]/90 px-6"
            accessibilityLabel={`Location map unavailable. ${mapError || 'Check your connection and try again.'}`}
          >
            {mapStatus === 'loading' ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text className="mt-3 text-center font-outfit-medium text-sm text-white">
                  Loading location map…
                </Text>
              </>
            ) : (
              <>
                <Text className="text-center font-outfit-bold text-base text-white">
                  Location map unavailable
                </Text>
                <Text className="mt-1 text-center font-outfit-medium text-sm text-white/80">
                  Check your connection and try again.
                </Text>
                <FeedbackPressable
                  onPress={retryMap}
                  className="mt-4 rounded-xl bg-white px-5 py-2.5"
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading location map"
                >
                  <Text className="font-outfit-bold text-sm text-[#21473f]">Retry</Text>
                </FeedbackPressable>
              </>
            )}
          </View>
        ) : null}


        <View className="absolute left-1/2 top-1/2 w-[50px] h-[60px] -ml-[25px] -mt-[50px] items-center justify-start pointer-events-none">
          <Image
            source={{
              uri: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            }}
            className="absolute w-[41px] h-[41px] left-[12px] top-[8px]"
          />

          <Svg width={50} height={50} viewBox="0 0 24 24">
            <Path
              d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12z"
              fill="#FFFFFF"
            />
            <Circle cx="12" cy="10" r="2.5" fill="#21473f" />
          </Svg>
        </View>
      </View>
    </View>
  );
}