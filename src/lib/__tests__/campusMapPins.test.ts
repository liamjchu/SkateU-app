/** @jest-environment jsdom */

import {
    PIN_POP_DURATION_MS,
    PIN_POP_PEAK_AT,
    PIN_SCALE_NORMAL,
    PIN_SCALE_PEAK,
    PIN_SCALE_SELECTED,
    PIN_UNSELECT_DURATION_MS,
    buildSelectSpotJavascript,
    getCampusMapPinScript,
    samplePinScaleFrames,
} from '../campusMapPins';

type MarkerMock = {
  getElement: () => HTMLElement;
  setZIndexOffset: jest.Mock;
};

type PinWindow = Window &
  typeof globalThis & {
    markers: Record<string, MarkerMock>;
    selectedSpotId: string | null;
    selectSpot: (id: string | null, options?: { pop?: boolean }) => void;
  };

const popFrames = [
  { t: 0, scale: PIN_SCALE_NORMAL },
  { t: PIN_POP_PEAK_AT, scale: PIN_SCALE_PEAK },
  { t: 1, scale: PIN_SCALE_SELECTED },
] as const;

function createMarker(): MarkerMock {
  const icon = document.createElement('div');
  icon.className = 'leaflet-marker-icon skateu-pin';
  icon.innerHTML = '<span class="skateu-pin-scale"></span>';
  document.body.appendChild(icon);
  return {
    getElement: () => icon,
    setZIndexOffset: jest.fn(),
  };
}

function installPinScript(): PinWindow {
  const testWindow = window as PinWindow;
  testWindow.markers = {};
  testWindow.selectedSpotId = null;
  Function(getCampusMapPinScript())();
  return testWindow;
}

function readScale(marker: MarkerMock): number {
  const el =
    marker.getElement().querySelector('.skateu-pin-scale') ?? marker.getElement();
  if (!(el instanceof HTMLElement)) {
    return 1;
  }
  const match = el.style.transform.match(/scale\(([^)]+)\)/);
  return match ? parseFloat(match[1]) : 1;
}

describe('campus map pin pop', () => {
  it('uses a short overshoot curve that settles larger than rest', () => {
    expect(PIN_POP_DURATION_MS).toBeGreaterThanOrEqual(180);
    expect(PIN_POP_DURATION_MS).toBeLessThanOrEqual(250);
    expect(PIN_UNSELECT_DURATION_MS).toBeGreaterThanOrEqual(160);
    expect(PIN_UNSELECT_DURATION_MS).toBeLessThanOrEqual(250);
    expect(samplePinScaleFrames(popFrames, 0)).toBeCloseTo(PIN_SCALE_NORMAL);
    expect(samplePinScaleFrames(popFrames, PIN_POP_PEAK_AT)).toBeCloseTo(
      PIN_SCALE_PEAK
    );
    expect(samplePinScaleFrames(popFrames, 1)).toBeCloseTo(PIN_SCALE_SELECTED);
    expect(PIN_SCALE_PEAK).toBeGreaterThan(PIN_SCALE_SELECTED);
    expect(PIN_SCALE_SELECTED).toBeGreaterThan(PIN_SCALE_NORMAL);
  });

  it('injects selection without rebuilding the map HTML', () => {
    expect(buildSelectSpotJavascript('spot-1')).toBe(
      'if (window.selectSpot) { window.selectSpot("spot-1"); } true;'
    );
    expect(buildSelectSpotJavascript(undefined)).toBe(
      'if (window.selectSpot) { window.selectSpot(null); } true;'
    );
  });

  it('interrupts in-flight pops when another pin is selected', () => {
    const rafQueue = new Map<number, FrameRequestCallback>();
    let nextRafId = 1;
    const rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        const id = nextRafId;
        nextRafId += 1;
        rafQueue.set(id, cb);
        return id;
      });
    const cancelSpy = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id) => {
        rafQueue.delete(Number(id));
      });
    const nowSpy = jest.spyOn(performance, 'now').mockReturnValue(0);

    const flushAt = (now: number) => {
      nowSpy.mockReturnValue(now);
      const callbacks = [...rafQueue.values()];
      rafQueue.clear();
      callbacks.forEach((cb) => cb(now));
    };

    const testWindow = installPinScript();
    const pinA = createMarker();
    const pinB = createMarker();
    testWindow.markers = { a: pinA, b: pinB };

    testWindow.selectSpot('a');
    expect(rafQueue.size).toBe(1);

    flushAt(80);
    const midScale = readScale(pinA);
    expect(midScale).toBeGreaterThan(PIN_SCALE_NORMAL);
    expect(midScale).toBeLessThanOrEqual(PIN_SCALE_PEAK);

    nowSpy.mockReturnValue(80);
    testWindow.selectSpot('b');

    expect(pinA.setZIndexOffset).toHaveBeenLastCalledWith(0);
    expect(pinB.setZIndexOffset).toHaveBeenLastCalledWith(1000);
    expect(cancelSpy).toHaveBeenCalled();

    flushAt(80 + PIN_POP_DURATION_MS);

    expect(readScale(pinA)).toBeCloseTo(PIN_SCALE_NORMAL);
    expect(readScale(pinB)).toBeCloseTo(PIN_SCALE_SELECTED);
    expect(rafQueue.size).toBe(0);

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it('restores the selected scale without popping after markers are recreated', () => {
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame');
    const testWindow = installPinScript();
    const pin = createMarker();
    testWindow.markers = { a: pin };

    testWindow.selectSpot('a', { pop: false });

    expect(rafSpy).not.toHaveBeenCalled();
    expect(readScale(pin)).toBe(PIN_SCALE_SELECTED);
    expect(pin.setZIndexOffset).toHaveBeenCalledWith(1000);

    rafSpy.mockRestore();
  });
});
