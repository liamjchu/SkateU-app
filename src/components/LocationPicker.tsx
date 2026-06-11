import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

type LayerType = 'default' | 'satellite';

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
  const webViewRef = useRef<WebView>(null);

  const [selectedLatitude, setSelectedLatitude] =
    useState<number>(initialLatitude);

  const [selectedLongitude, setSelectedLongitude] =
    useState<number>(initialLongitude);

  useEffect(() => {
    onLocationChange(selectedLatitude, selectedLongitude);
  }, [selectedLatitude, selectedLongitude, onLocationChange]);

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
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
      const center = [${initialLatitude}, ${initialLongitude}];

      window.map = L.map('map', {
        zoomControl: false,
      }).setView(center, 15.5);

      const defaultUrl =
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

      const satelliteUrl =
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png';

      const defaultLayer = L.tileLayer(defaultUrl);
      const satelliteLayer = L.tileLayer(satelliteUrl);

      const selectedLayer =
        '${initialLayer}' === 'satellite'
          ? satelliteLayer
          : defaultLayer;

      selectedLayer.addTo(window.map);

      function postCenter() {
        if (
          !window.map ||
          !window.ReactNativeWebView ||
          !window.ReactNativeWebView.postMessage
        ) {
          return;
        }

        const center = window.map.getCenter();

        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'CENTER_CHANGED',
            latitude: center.lat,
            longitude: center.lng,
          })
        );
      }

      function postInteractionStart() {
        if (
          !window.ReactNativeWebView ||
          !window.ReactNativeWebView.postMessage
        ) {
          return;
        }

        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'INTERACTION_START',
          })
        );
      }

      function postInteractionEnd() {
        if (
          !window.ReactNativeWebView ||
          !window.ReactNativeWebView.postMessage
        ) {
          return;
        }

        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'INTERACTION_END',
          })
        );
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

      document.addEventListener(
        'touchstart',
        postInteractionStart,
        { passive: true }
      );

      document.addEventListener(
        'touchend',
        postInteractionEnd,
        { passive: true }
      );

      postCenter();
    </script>
  </body>
  </html>
  `;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type: string;
        latitude?: number;
        longitude?: number;
      };

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

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html }}
          onMessage={handleMessage}
          style={styles.webview}
        />

        <View pointerEvents="none" style={styles.pinWrapper}>
          <Image
            source={{
              uri: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            }}
            style={styles.shadow}
          />

          <Svg width={50} height={50} viewBox="0 0 24 24">
            <Path
              d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12z"
              fill="#FFFFFF"
            />
            <Circle
              cx="12"
              cy="10"
              r="2.5"
              fill="#21473f"
            />
          </Svg>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dce5e2',
    backgroundColor: '#f7f8f8',
  },

  mapContainer: {
    height: 224,
    position: 'relative',
    backgroundColor: '#000',
  },

  webview: {
    flex: 1,
    backgroundColor: '#0b0f14',
  },

  pinWrapper: {
    position: 'absolute',
    left: '50%',
    top: '50%',

    width: 50,
    height: 60,

    marginLeft: -25,
    marginTop: -50,

    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  shadow: {
    position: 'absolute',

    width: 41,
    height: 41,

    left: 12,
    top: 8,

    opacity: 1,
  },
});