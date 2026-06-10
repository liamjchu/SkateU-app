import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

type LayerType = 'default' | 'satellite';

type LocationPickerProps = {
  initialLatitude: number;
  initialLongitude: number;
  initialLayer: LayerType;
  onLocationChange: (latitude: number, longitude: number) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
};

export default function LocationPicker({ initialLatitude, initialLongitude, initialLayer, onLocationChange, onInteractionChange }: LocationPickerProps) {
  const webViewRef = useRef<WebView>(null);
  const [selectedLatitude, setSelectedLatitude] = useState<number>(initialLatitude);
  const [selectedLongitude, setSelectedLongitude] = useState<number>(initialLongitude);

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
      html, body { margin: 0; padding: 0; background: #0b0f14; }
      #map { height: 100vh; width: 100vw; }
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
      const center = [${initialLatitude}, ${initialLongitude}];
      window.map = L.map('map', { zoomControl: false }).setView(center, 15.5);
      const defaultUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png';
      const defaultLayer = L.tileLayer(defaultUrl);
      const satelliteLayer = L.tileLayer(satelliteUrl);
      const selectedLayer = '${initialLayer}' === 'satellite' ? satelliteLayer : defaultLayer;
      selectedLayer.addTo(window.map);

      function postCenter() {
        if (!window.map || !window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) return;
        const center = window.map.getCenter();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CENTER_CHANGED', latitude: center.lat, longitude: center.lng }));
      }

      function postInteractionStart() {
        if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'INTERACTION_START' }));
      }

      function postInteractionEnd() {
        if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'INTERACTION_END' }));
      }

      // Pan and zoom events
      window.map.on('movestart', postInteractionStart);
      window.map.on('moveend', function () { postCenter(); postInteractionEnd(); });
      window.map.on('zoomstart', postInteractionStart);
      window.map.on('zoomend', function () { postCenter(); postInteractionEnd(); });

      // Touch events as a fallback for some platforms
      document.addEventListener('touchstart', postInteractionStart, { passive: true });
      document.addEventListener('touchend', postInteractionEnd, { passive: true });

      postCenter();
    </script>
  </body>
  </html>
  `;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type: string; latitude?: number; longitude?: number };
      if (data.type === 'CENTER_CHANGED' && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
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
    <View className="mb-6 rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
      <View className="px-4 py-3 bg-white">
        <Text className="text-base font-semibold text-slate-950">Location</Text>
        <Text className="text-sm text-slate-500 mt-1">Move the map until the pin is over the desired spot.</Text>
      </View>

      <View className="relative h-56 bg-black">
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html }}
          onMessage={handleMessage}
          style={styles.webview}
        />
        <View style={styles.pinWrapper} pointerEvents="none">
          <View style={styles.pinHead} />
          <View style={styles.pinTail} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#0b0f14',
  },
  pinWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 24,
    height: 36,
    marginLeft: -12,
    marginTop: -36,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pinHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#38bdf8',
    borderWidth: 3,
    borderColor: 'white',
  },
  pinTail: {
    width: 10,
    height: 18,
    marginTop: -2,
    backgroundColor: '#38bdf8',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
});
