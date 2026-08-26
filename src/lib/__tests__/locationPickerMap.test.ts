/** @jest-environment jsdom */

import { array, assert, constantFrom, property } from 'fast-check';
import {
    buildLocationPickerHtml,
    type LocationMapLayer,
} from '../locationPickerMap';

type MapMock = {
  listeners: Record<string, Array<() => void>>;
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  getBearing: () => number;
  loaded: () => boolean;
  on: (event: string, handler: () => void) => MapMock;
  once: (event: string, handler: () => void) => MapMock;
  getSource: (id: string) => unknown;
  addSource: jest.Mock;
  addLayer: jest.Mock;
  setLayoutProperty: jest.Mock;
  easeTo: jest.Mock;
};

type TestWindow = Window &
  typeof globalThis & {
    maplibregl: {
      Map: new (options: object) => MapMock;
    };
    ReactNativeWebView: { postMessage: (message: string) => void };
    currentLayer: LocationMapLayer;
    setMapLayer: (layer: LocationMapLayer) => void;
    toggleLayer: () => void;
    setUserLocation: (lat: number, lng: number, accuracy: number) => void;
    clearUserLocation: () => void;
    goToUserLocation: (zoom?: number) => void;
    resetMapNorth: () => void;
  };

type Harness = {
  map: MapMock;
  messages: { type: string; layer?: LocationMapLayer }[];
  button: HTMLButtonElement;
  mapElement: HTMLElement;
  testWindow: TestWindow;
};

function installMap(initialLayer: LocationMapLayer = 'default'): Harness {
  const map: MapMock = {
    listeners: {},
    getCenter: () => ({ lat: 41.8268, lng: -71.401 }),
    getZoom: () => 15.5,
    getBearing: () => 0,
    loaded: () => false,
    on: (event, handler) => {
      map.listeners[event] = map.listeners[event] ?? [];
      map.listeners[event].push(handler);
      return map;
    },
    once: (event, handler) => {
      const wrapped = () => {
        map.listeners[event] = (map.listeners[event] ?? []).filter(
          (candidate) => candidate !== wrapped
        );
        handler();
      };
      return map.on(event, wrapped);
    },
    getSource: () => undefined,
    addSource: jest.fn(),
    addLayer: jest.fn(),
    setLayoutProperty: jest.fn(),
    easeTo: jest.fn(),
  };
  const messages: Harness['messages'] = [];
  const testWindow = window as TestWindow;

  testWindow.maplibregl = {
    Map: function Map() {
      return map;
    } as unknown as new (options: object) => MapMock,
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
  expect(harness.testWindow.currentLayer).toBe(expected);
  expect(harness.mapElement.classList.contains('satellite')).toBe(
    expected === 'satellite'
  );
  expect(harness.button.getAttribute('aria-pressed')).toBe(
    String(expected === 'satellite')
  );
}

describe('location picker map layers', () => {
  it('loads OpenFreeMap instead of CARTO raster tiles', () => {
    const html = buildLocationPickerHtml({
      latitude: 41.8268,
      longitude: -71.401,
      layer: 'default',
    });
    expect(html).toContain('tiles.openfreemap.org/styles/liberty');
    expect(html).toContain('maplibre-gl');
    expect(html).toContain('resetMapNorth');
    expect(html).not.toContain('basemaps.cartocdn.com');
  });

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

    harness.testWindow.setUserLocation(41.83, -71.4, 10);
    harness.testWindow.goToUserLocation();

    expect(harness.map.easeTo).toHaveBeenCalledWith({
      center: [-71.4, 41.83],
      zoom: 15.5,
    });
    expectLayer(harness, 'default');
  });

  it('resets bearing to north without changing layers', () => {
    const harness = installMap();

    harness.testWindow.resetMapNorth();

    expect(harness.map.easeTo).toHaveBeenCalledWith({
      bearing: 0,
      pitch: 0,
    });
    expectLayer(harness, 'default');
  });
});
