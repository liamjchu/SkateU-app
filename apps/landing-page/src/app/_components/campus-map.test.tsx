// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanup, click, render, rerender } from "../../test/react-dom";
import { CAMPUS_MAP_STYLE_URL, CAMPUS_MAP_ZOOM, type CampusSpot } from "../../lib/campus";
import { CampusMap } from "./campus-map";

const spotId = "22222222-2222-4222-8222-222222222222";
const spot: CampusSpot = {
  id: spotId,
  name: "Ledge",
  description: "Waxed",
  latitude: 38.831,
  longitude: -77.307,
  imageUrl: "https://cdn.example/ledge.jpg",
  likeCount: 4,
  creatorUsername: "ada",
};

const mapMock = vi.hoisted(() => {
  const created: Array<{
    options: { style: string; center: [number, number]; zoom: number };
    remove: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    easeTo: ReturnType<typeof vi.fn>;
  }> = [];
  const markers: HTMLButtonElement[] = [];
  let mode: "ok" | "throw" | "error" = "ok";

  class Map {
    remove = vi.fn();
    resize = vi.fn();
    easeTo = vi.fn();
    options: { style: string; center: [number, number]; zoom: number };

    constructor(options: { style: string; center: [number, number]; zoom: number }) {
      this.options = options;
      created.push(this);

      if (mode === "throw") {
        throw new Error("map failed");
      }
    }

    on(event: string, callback: () => void) {
      if (event === "load" && mode === "ok") {
        callback();
      }

      if (event === "error" && mode === "error") {
        callback();
      }
    }
  }

  class Marker {
    element: HTMLButtonElement;

    constructor(options: { element: HTMLButtonElement }) {
      this.element = options.element;
      markers.push(options.element);
    }

    setLngLat() {
      return this;
    }

    addTo() {
      return this;
    }

    remove() {
      const index = markers.indexOf(this.element);

      if (index >= 0) {
        markers.splice(index, 1);
      }
    }
  }

  return {
    Map,
    Marker,
    created,
    markers,
    setMode(next: "ok" | "throw" | "error") {
      mode = next;
    },
    reset() {
      created.length = 0;
      markers.length = 0;
      mode = "ok";
    },
  };
});

vi.mock("maplibre-gl", () => ({
  Map: mapMock.Map,
  Marker: mapMock.Marker,
}));

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

beforeEach(() => {
  mapMock.reset();
});

afterEach(cleanup);

describe("CampusMap", () => {
  it("centers the campus and selects a pin", () => {
    const onSelectSpot = vi.fn();
    const container = render(
      <CampusMap
        schoolName="George Mason University"
        latitude={38.83}
        longitude={-77.3}
        spots={[spot]}
        selectedSpotId={spotId}
        onSelectSpot={onSelectSpot}
      />
    );
    const map = mapMock.created[0];
    const pin = mapMock.markers[0];

    expect(container.querySelector("[aria-label='Map of George Mason University']")).not.toBeNull();
    expect(map?.options).toMatchObject({
      style: CAMPUS_MAP_STYLE_URL,
      center: [-77.3, 38.83],
      zoom: CAMPUS_MAP_ZOOM,
    });
    expect(pin?.getAttribute("aria-pressed")).toBe("true");
    expect(map?.easeTo).toHaveBeenCalledWith({
      center: [spot.longitude, spot.latitude],
      zoom: CAMPUS_MAP_ZOOM,
    });

    if (!pin) {
      throw new Error("Pin missing.");
    }

    click(pin);
    expect(onSelectSpot).toHaveBeenCalledWith(spotId);
    cleanup();
    expect(map?.remove).toHaveBeenCalled();
  });

  it("lets the user retry when the map cannot start", () => {
    mapMock.setMode("throw");
    const container = render(
      <CampusMap
        schoolName="George Mason University"
        latitude={38.83}
        longitude={-77.3}
        spots={[]}
        selectedSpotId={null}
        onSelectSpot={vi.fn()}
      />
    );

    expect(container.textContent).toContain("The map didn’t load.");
    mapMock.setMode("ok");
    const retry = container.querySelector("button");

    if (!(retry instanceof HTMLButtonElement)) {
      throw new Error("Retry button missing.");
    }

    click(retry);
    expect(container.textContent).not.toContain("The map didn’t load.");
    expect(mapMock.created).toHaveLength(2);
  });

  it("shows the same retry state when the style fails to load", () => {
    mapMock.setMode("error");
    const container = render(
      <CampusMap
        schoolName="George Mason University"
        latitude={38.83}
        longitude={-77.3}
        spots={[spot]}
        selectedSpotId={null}
        onSelectSpot={vi.fn()}
      />
    );

    expect(container.textContent).toContain("The map didn’t load.");
    expect(mapMock.markers).toHaveLength(0);
  });

  it("replaces pins without moving the camera", () => {
    const other: CampusSpot = {
      ...spot,
      id: "33333333-3333-4333-8333-333333333333",
      name: "Gap",
      latitude: 38.9,
      longitude: -77.4,
    };
    const spots = [spot];
    const props = {
      schoolName: "George Mason University",
      latitude: 38.83,
      longitude: -77.3,
      onSelectSpot: vi.fn(),
    };
    render(
      <CampusMap
        {...props}
        spots={spots}
        selectedSpotId={null}
      />
    );
    const map = mapMock.created[0];

    expect(mapMock.created).toHaveLength(1);
    map?.easeTo.mockClear();

    const nextSpots = [spot, other];
    rerender(
      <CampusMap
        {...props}
        spots={nextSpots}
        selectedSpotId={null}
      />
    );

    expect(mapMock.created).toHaveLength(1);
    expect(map?.easeTo).not.toHaveBeenCalled();
    expect(mapMock.markers).toHaveLength(2);

    rerender(
      <CampusMap
        {...props}
        spots={nextSpots}
        selectedSpotId={other.id}
      />
    );

    expect(mapMock.created).toHaveLength(1);
    expect(map?.easeTo).toHaveBeenCalledTimes(1);
    expect(map?.easeTo).toHaveBeenCalledWith({
      center: [other.longitude, other.latitude],
      zoom: CAMPUS_MAP_ZOOM,
    });
    expect(mapMock.markers.find((pin) => pin.getAttribute("aria-label") === "Gap")?.getAttribute("aria-pressed")).toBe(
      "true"
    );
  });
});
