/** @jest-environment jsdom */

import { array, assert, constantFrom, property } from 'fast-check';
import {
    buildLocationPickerHtml,
    type LocationMapLayer,
} from '../locationPickerMap';

type LayerMock = {
  id: LocationMapLayer;
  addTo: (map: MapMock) => LayerMock;
};

type MapMock = {
  activeLayers: Set<LayerMock>;
  setView: (
    center: [number, number] | { lat: number; lng: number },
    zoom: number,
    options?: object
  ) => MapMock;
  removeLayer: (layer: LayerMock) => void;
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  on: (event: string, handler: () => void) => void;
};

type TestWindow = Window &
  typeof globalThis & {
    L: {
      map: (elementId: string, options: object) => MapMock;
      tileLayer: (url: string) => LayerMock;
      latLng: (lat: number, lng: number) => { lat: number; lng: number };
      circle: (
        latlng: { lat: number; lng: number },
        options: { radius: number }
      ) => unknown;
      circleMarker: (latlng: { lat: number; lng: number }) => unknown;
      DomEvent: {
        disableClickPropagation: (element: HTMLElement) => void;
        disableScrollPropagation: (element: HTMLElement) => void;
      };
    };
    ReactNativeWebView: { postMessage: (message: string) => void };
    currentLayer: LayerMock;
    setMapLayer: (layer: LocationMapLayer) => void;
    toggleLayer: () => void;
    setUserLocation: (lat: number, lng: number, accuracy: number) => void;
    clearUserLocation: () => void;
    goToUserLocation: (zoom?: number) => void;
  };

type Harness = {
  map: MapMock;
  messages: { type: string; layer?: LocationMapLayer }[];
  button: HTMLButtonElement;
  mapElement: HTMLElement;
  testWindow: TestWindow;
};

function createLayer(id: LocationMapLayer): LayerMock {
  const layer: LayerMock = {
    id,
    addTo: (map) => {
      map.activeLayers.add(layer);
      return layer;
    },
  };
  return layer;
}

function installMap(initialLayer: LocationMapLayer = 'default'): Harness {
  const map: MapMock = {
    activeLayers: new Set(),
    setView: () => map,
    removeLayer: (layer) => {
      map.activeLayers.delete(layer);
    },
    getCenter: () => ({ lat: 41.8268, lng: -71.401 }),
    getZoom: () => 15.5,
    on: () => undefined,
  };
  const messages: Harness['messages'] = [];
  const testWindow = window as TestWindow;

  testWindow.L = {
    map: () => map,
    tileLayer: (url) =>
      createLayer(url.includes('World_Imagery') ? 'satellite' : 'default'),
    latLng: (lat: number, lng: number) => ({ lat, lng }),
    circle: (latlng: { lat: number; lng: number }, options: { radius: number }) => {
      const layer = {
        id: 'default' as LocationMapLayer,
        latlng,
        radius: options.radius,
        addTo: () => layer,
        setLatLng: (next: { lat: number; lng: number }) => {
          layer.latlng = next;
        },
        setRadius: (radius: number) => {
          layer.radius = radius;
        },
      };
      return layer;
    },
    circleMarker: (latlng: { lat: number; lng: number }) => {
      const layer = {
        id: 'default' as LocationMapLayer,
        latlng,
        addTo: () => layer,
        setLatLng: (next: { lat: number; lng: number }) => {
          layer.latlng = next;
        },
      };
      return layer;
    },
    DomEvent: {
      disableClickPropagation: () => undefined,
      disableScrollPropagation: () => undefined,
    },
  };
  testWindow.ReactNativeWebView = {
    postMessage: (message) => {
      messages.push(JSON.parse(message) as Harness['messages'][number]);
    },
  };

  const html = buildLocationPickerHtml({
    latitude: 41.8268,
    longitude: -71.401,
    layer: initialLayer,
  });
  const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
  document.head.innerHTML = parsedDocument.head.innerHTML;
  document.body.innerHTML = parsedDocument.body.innerHTML;

  const script = document.getElementById('location-map-script')?.textContent;
  if (!script) {
    throw new Error('Location map script was not generated.');
  }
  Function(script)();

  const button = document.getElementById('layer-toggle');
  const mapElement = document.getElementById('map');
  if (!(button instanceof HTMLButtonElement) || !mapElement) {
    throw new Error('Location map controls were not generated.');
  }

  return { map, messages, button, mapElement, testWindow };
}

function expectLayer(harness: Harness, expected: LocationMapLayer): void {
  expect(harness.map.activeLayers.size).toBe(1);
  expect([...harness.map.activeLayers][0]?.id).toBe(expected);
  expect(harness.testWindow.currentLayer.id).toBe(expected);
  expect(harness.mapElement.classList.contains('satellite')).toBe(
    expected === 'satellite'
  );
  expect(harness.button.getAttribute('aria-pressed')).toBe(
    String(expected === 'satellite')
  );
}


describe('location picker map layers', () => {
  it('toggles reliably for 1,000 consecutive button clicks', () => {
    const harness = installMap();

    for (let press = 1; press <= 1_000; press += 1) {
      harness.button.click();
      expectLayer(harness, press % 2 === 1 ? 'satellite' : 'default');
    }

    const layerMessages = harness.messages.filter(
      (message) => message.type === 'LAYER_TOGGLED'
    );
    expect(layerMessages).toHaveLength(1_000);
    expect(layerMessages.at(-1)).toEqual({
      type: 'LAYER_TOGGLED',
      layer: 'default',
    });
  });

  it('keeps exactly one active layer for arbitrary selection sequences', () => {
    const harness = installMap();

    assert(
      property(
        array(constantFrom<LocationMapLayer>('default', 'satellite'), {
          maxLength: 200,
        }),
        (layers) => {
          harness.testWindow.setMapLayer('default');
          for (const layer of layers) {
            harness.testWindow.setMapLayer(layer);
            expectLayer(harness, layer);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('pans to a stored user location without changing layers', () => {
    const harness = installMap();
    const setView = jest.fn(() => harness.map);
    harness.map.setView = setView;

    harness.testWindow.setUserLocation(41.83, -71.4, 10);
    harness.testWindow.goToUserLocation();

    expect(setView).toHaveBeenCalledWith(
      { lat: 41.83, lng: -71.4 },
      15.5,
      { animate: true }
    );
    expectLayer(harness, 'default');
  });
});
