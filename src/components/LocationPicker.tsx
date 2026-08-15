import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    StyleSheet,
    Text,
    View
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import IMAGES from '../constants/images';
import { colors } from '../constants/colors';
import { useIsTabletLayout } from '../hooks/useIsTabletLayout';
import { buildLocationPickerHtml } from '../lib/locationPickerMap';
import type { MapLayer } from '../store/mapViewStore';
import FeedbackPressable from './FeedbackPressable';

export type LayerType = MapLayer;
export type LocationPickerStatus = 'loading' | 'ready' | 'error';

type LocationPickerWebViewMessage =
  | { type: 'WEBVIEW_READY' }
  | { type: 'CONSOLE_ERROR'; message?: unknown }
  | { type: 'LAYER_TOGGLED'; layer?: unknown }
  | { type: 'CENTER_CHANGED'; latitude?: unknown; longitude?: unknown }
  | { type: 'INTERACTION_START' }
  | { type: 'INTERACTION_END' };

function isLocationPickerWebViewMessage(
  value: unknown
): value is LocationPickerWebViewMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  );
}

type LocationPickerProps = {
  initialLatitude: number;
  initialLongitude: number;
  initialLayer: LayerType;
  onLocationChange: (latitude: number, longitude: number) => void;
  onStatusChange?: (status: LocationPickerStatus, error: string) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
};

export default function LocationPicker({
  initialLatitude,
  initialLongitude,
  initialLayer,
  onLocationChange,
  onStatusChange,
  onInteractionChange,
}: LocationPickerProps) {
  const isTabletLayout = useIsTabletLayout();
  const webViewRef = useRef<WebView>(null);
  const mapLayerRef = useRef<LayerType>(initialLayer);
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
    if (mapStatus === 'ready') {
      onLocationChange(selectedLatitude, selectedLongitude);
    }
  }, [mapStatus, onLocationChange, selectedLatitude, selectedLongitude]);

  useEffect(() => {
    onStatusChange?.(mapStatus, mapError);
  }, [mapError, mapStatus, onStatusChange]);

  const html = useMemo(
    () => buildLocationPickerHtml(initialRef.current),
    []
  );

  const webViewSource = useMemo(
    () => ({ html, baseUrl: 'https://localhost' }),
    [html]
  );

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
      const data: unknown = JSON.parse(event.nativeEvent.data);
      if (!isLocationPickerWebViewMessage(data)) {
        return;
      }

      if (data.type === 'WEBVIEW_READY') {
        setMapStatus('ready');
        setMapError('');
        webViewRef.current?.injectJavaScript(
          `if (window.setMapLayer) { window.setMapLayer('${mapLayerRef.current}'); } true;`
        );
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
        mapLayerRef.current = layer;
        setMapLayer(layer);
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
    <View className="overflow-hidden rounded-2xl bg-field">
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
          source={webViewSource}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          onContentProcessDidTerminate={retryMap}
          onRenderProcessGone={retryMap}
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
          style={{ flex: 1, backgroundColor: colors.brand }}
        />

        {mapStatus !== 'ready' ? (
          <View
            className="absolute inset-0 items-center justify-center bg-brand/90 px-6"
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
                <Text className="mt-1 text-center font-outfit-medium text-sm text-white">
                  Check your connection and try again.
                </Text>
                <FeedbackPressable
                  onPress={retryMap}
                  className="mt-4 rounded-xl bg-accent px-5 py-2.5"
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading location map"
                >
                  <Text className="font-outfit-bold text-sm text-brand">Retry</Text>
                </FeedbackPressable>
              </>
            )}
          </View>
        ) : null}
        {mapStatus === 'ready' ? (
          <FeedbackPressable
            haptic="selection"
            onPress={() => {
              webViewRef.current?.injectJavaScript(
                `window.toggleLayer(); true;`
              );
            }}
            className="absolute right-3 top-3 z-10 h-11 w-11 items-center justify-center rounded-full bg-white"
            style={styles.mapControl}
            accessibilityRole="button"
            accessibilityLabel={
              mapLayer === 'satellite'
                ? 'Switch to standard map'
                : 'Switch to satellite map'
            }
            accessibilityState={{ selected: mapLayer === 'satellite' }}
          >
            <Image source={IMAGES.layers} className="h-[18px] w-[18px] tint-brand" />
          </FeedbackPressable>
        ) : null}
        {mapStatus === 'ready' ? (
          <View className="absolute left-1/2 top-1/2 h-[60px] w-[50px] -ml-[25px] -mt-[50px] items-center justify-start pointer-events-none">
            <Image
              source={IMAGES.markerShadow}
              className="absolute left-[12px] top-[8px] h-[41px] w-[41px]"
              accessible={false}
            />

            <Svg width={50} height={50} viewBox="0 0 24 24">
              <Path
                d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12z"
                fill={colors.accent}
                stroke={colors.brand}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              <Circle cx="12" cy="10" r="2.5" fill={colors.white} />
            </Svg>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapControl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 6,
  },
});