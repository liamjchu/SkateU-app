import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, View } from 'react-native';
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

      const selectedLayer =
        '${layer}' === 'satellite'
          ? satelliteLayer
          : defaultLayer;

      selectedLayer.addTo(window.map);

      function postCenter() {
        const center = window.map.getCenter();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CENTER_CHANGED',
          latitude: center.lat,
          longitude: center.lng,
        }));
      }

      function postInteractionStart() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'INTERACTION_START'
        }));
      }

      function postInteractionEnd() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'INTERACTION_END'
        }));
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

      postCenter();
    </script>
  </body>
  </html>
  `;
  }, []);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

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
    <View className="mb-6 rounded-2xl overflow-hidden border border-[#dce5e2] bg-[#f7f8f8]">
      <View className="h-[224px] relative bg-black">
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html }}
          onMessage={handleMessage}
          style={{ flex: 1, backgroundColor: '#0b0f14' }}
        />

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