/** @jest-environment jsdom */

import {
    PIN_OPACITY_DIMMED,
    PIN_OPACITY_NORMAL,
    PIN_POP_DURATION_MS,
    PIN_POP_PEAK_AT,
    PIN_SCALE_DIMMED,
    PIN_SCALE_NORMAL,
    PIN_SCALE_PEAK,
    PIN_SCALE_SELECTED,
    PIN_UNSELECT_DURATION_MS,
    buildSelectSpotJavascript,
    easeOutCubic,
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

function scaleEl(marker: MarkerMock): HTMLElement {
  const el =
    marker.getElement().querySelector('.skateu-pin-scale') ?? marker.getElement();
  if (!(el instanceof HTMLElement)) {
    throw new Error('missing pin scale element');
  }
  return el;
}

function readScale(marker: MarkerMock): number {
  const match = scaleEl(marker).style.transform.match(/scale\(([^)]+)\)/);
  return match ? parseFloat(match[1]) : 1;
}

function readOpacity(marker: MarkerMock): number {
  const parsed = parseFloat(scaleEl(marker).style.opacity);
  return Number.isFinite(parsed) ? parsed : 1;
}

describe('campus map pin pop', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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
    expect(PIN_SCALE_DIMMED).toBeLessThan(PIN_SCALE_NORMAL);
    expect(PIN_OPACITY_DIMMED).toBeLessThan(PIN_OPACITY_NORMAL);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(samplePinScaleFrames([], 0.5)).toBe(PIN_SCALE_NORMAL);
    expect(samplePinScaleFrames(popFrames, 1.5)).toBeCloseTo(PIN_SCALE_SELECTED);
    expect(
      samplePinScaleFrames(
        [
          { t: 0.4, scale: 1 },
          { t: 0.4, scale: 2 },
        ],
        0.4
      )
    ).toBe(2);
  });

  it('injects selection without rebuilding the map HTML', () => {
    expect(buildSelectSpotJavascript('spot-1')).toBe(
      'if (window.selectSpot) { window.selectSpot("spot-1"); } true;'
    );
    expect(buildSelectSpotJavascript(undefined)).toBe(
      'if (window.selectSpot) { window.selectSpot(null); } true;'
    );
  });

  it('dims unselected pins when another pin is selected', () => {
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
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
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
    flushAt(PIN_POP_DURATION_MS);

    expect(readScale(pinA)).toBeCloseTo(PIN_SCALE_SELECTED);
    expect(readOpacity(pinA)).toBeCloseTo(PIN_OPACITY_NORMAL);
    expect(readScale(pinB)).toBeCloseTo(PIN_SCALE_DIMMED);
    expect(readOpacity(pinB)).toBeCloseTo(PIN_OPACITY_DIMMED);

    rafSpy.mockRestore();
    nowSpy.mockRestore();
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
    expect(rafQueue.size).toBe(2);

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

    expect(readScale(pinA)).toBeCloseTo(PIN_SCALE_DIMMED);
    expect(readOpacity(pinA)).toBeCloseTo(PIN_OPACITY_DIMMED);
    expect(readScale(pinB)).toBeCloseTo(PIN_SCALE_SELECTED);
    expect(readOpacity(pinB)).toBeCloseTo(PIN_OPACITY_NORMAL);
    expect(rafQueue.size).toBe(0);

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it('restores every pin when selection is cleared', () => {
    const rafQueue = new Map<number, FrameRequestCallback>();
    let nextRafId = 1;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextRafId;
      nextRafId += 1;
      rafQueue.set(id, cb);
      return id;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
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
    flushAt(PIN_POP_DURATION_MS);
    testWindow.selectSpot(null);
    flushAt(PIN_POP_DURATION_MS + PIN_UNSELECT_DURATION_MS);

    expect(readScale(pinA)).toBeCloseTo(PIN_SCALE_NORMAL);
    expect(readOpacity(pinA)).toBeCloseTo(PIN_OPACITY_NORMAL);
    expect(readScale(pinB)).toBeCloseTo(PIN_SCALE_NORMAL);
    expect(readOpacity(pinB)).toBeCloseTo(PIN_OPACITY_NORMAL);
  });

  it('restores the selected scale without popping after markers are recreated', () => {
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame');
    const testWindow = installPinScript();
    const pinA = createMarker();
    const pinB = createMarker();
    testWindow.markers = { a: pinA, b: pinB };

    testWindow.selectSpot('a', { pop: false });

    expect(rafSpy).not.toHaveBeenCalled();
    expect(readScale(pinA)).toBe(PIN_SCALE_SELECTED);
    expect(readOpacity(pinA)).toBe(PIN_OPACITY_NORMAL);
    expect(readScale(pinB)).toBe(PIN_SCALE_DIMMED);
    expect(readOpacity(pinB)).toBe(PIN_OPACITY_DIMMED);
    expect(pinA.getElement().style.opacity).toBe('');
    expect(pinB.getElement().style.opacity).toBe('');
    expect(pinA.setZIndexOffset).toHaveBeenCalledWith(1000);
    expect(pinB.setZIndexOffset).toHaveBeenCalledWith(0);

    rafSpy.mockRestore();
  });
});
