// @vitest-environment jsdom

import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, click, render, waitFor } from "../../test/react-dom";
import type { CampusSchool, CampusSpot } from "../../lib/campus";
import { CampusExplorer } from "./campus-explorer";

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockCampusMap(props: {
      schoolName: string;
      spots: Array<{ id: string; name: string }>;
      onSelectSpot: (spotId: string) => void;
    }) {
      return (
        <div aria-label={`Map of ${props.schoolName}`}>
          {props.spots.map((spot) => (
            <button key={spot.id} type="button" onClick={() => props.onSelectSpot(spot.id)}>
              {spot.name} marker
            </button>
          ))}
        </div>
      );
    },
}));

const school: CampusSchool = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "George Mason University",
  city: "Fairfax",
  state: "VA",
  lat: 38.83,
  lng: -77.3,
  numSpots: 2,
};

const ledge: CampusSpot = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Ledge",
  description: "Waxed curb",
  latitude: 38.831,
  longitude: -77.307,
  imageUrl: "https://cdn.example/ledge.jpg",
  likeCount: 1,
  creatorUsername: "ada",
};

const gap: CampusSpot = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Gap",
  description: "   ",
  latitude: 38.832,
  longitude: -77.308,
  imageUrl: null,
  likeCount: 0,
  creatorUsername: null,
};

const rail: CampusSpot = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Rail",
  description: "Big stair",
  latitude: 37.23,
  longitude: -80.42,
  imageUrl: null,
  likeCount: 3,
  creatorUsername: null,
  schoolName: "Virginia Tech",
};

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

function buttonNamed(container: HTMLElement, name: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent === name);

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`${name} button missing.`);
  }

  return button;
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

describe("CampusExplorer", () => {
  it("lists spots and opens the same card from the list or a marker", async () => {
    window.history.replaceState(null, "", `/school/${school.id}`);
    const container = render(
      <CampusExplorer school={school} spots={[ledge, gap]} initialSpotId={null} />
    );

    expect(container.textContent).toContain("George Mason University");
    expect(container.textContent).toContain("Fairfax, VA");
    expect(container.textContent).toContain("2 spots");

    const listButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Gap"
    );

    if (!listButton) {
      throw new Error("Spot row missing.");
    }

    click(listButton);
    expect(container.textContent).toContain("No photo yet");
    expect(container.textContent).toContain("0 likes");
    expect(container.textContent).not.toContain("Added by");
    expect(window.location.search).toBe(`?spot=${gap.id}`);

    const back = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Spot list"
    );

    if (!back) {
      throw new Error("Back button missing.");
    }

    click(back);
    expect(container.textContent).not.toContain("No photo yet");
    expect(window.location.search).toBe("");

    const marker = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Ledge marker"
    );

    if (!marker) {
      throw new Error("Marker missing.");
    }

    click(marker);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(ledge.imageUrl);
    expect(container.textContent).toContain("Waxed curb");
    expect(container.textContent).toContain("1 like");
    expect(container.textContent).toContain("Added by @ada");
    expect(window.location.search).toBe(`?spot=${ledge.id}`);

    const image = container.querySelector("img");

    if (!(image instanceof HTMLImageElement)) {
      throw new Error("Photo missing.");
    }

    image.dispatchEvent(new Event("error"));
    await act(async () => undefined);
    expect(container.textContent).toContain("No photo yet");
  });

  it("opens a shared spot and ignores an unknown one", () => {
    const container = render(
      <CampusExplorer school={school} spots={[ledge]} initialSpotId={ledge.id} />
    );

    expect(container.textContent).toContain("Waxed curb");

    cleanup();
    const emptySelection = render(
      <CampusExplorer school={school} spots={[ledge]} initialSpotId={gap.id} />
    );

    expect(emptySelection.querySelector("article")).toBeNull();
    expect(emptySelection.textContent).toContain("Ledge");
  });

  it("shows an empty campus", () => {
    const container = render(
      <CampusExplorer school={{ ...school, numSpots: 0 }} spots={[]} initialSpotId={null} />
    );

    expect(container.textContent).toContain("0 spots");
    expect(container.textContent).toContain("No spots at this school yet.");
    expect(container.querySelector('a[href="/privacy"]')?.textContent).toBe("Privacy Policy");
    expect(container.querySelector('a[href="/delete-account"]')?.textContent).toBe(
      "Delete account"
    );
  });

  it("loads every spot once, then returns to this school", async () => {
    let resolveSpots: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveSpots = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));
    const container = render(
      <CampusExplorer school={school} spots={[ledge, gap]} initialSpotId={null} />
    );

    click(buttonNamed(container, "All spots"));
    expect(container.textContent).toContain("Loading spots…");
    await act(async () => {
      resolveSpots(jsonResponse({ spots: [ledge, rail, { name: "skip" }] }));
    });
    await waitFor(() => {
      expect(container.textContent).toContain("This school");
    });

    expect(container.textContent).toContain("Virginia Tech");
    expect(container.textContent).not.toContain("Gap");
    expect(fetch).toHaveBeenCalledTimes(1);

    click(buttonNamed(container, "This school"));
    expect(container.textContent).not.toContain("Virginia Tech");
    expect(container.textContent).toContain("2 spots");

    click(buttonNamed(container, "All spots"));
    expect(container.textContent).toContain("Virginia Tech");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps this school’s spots when every spot fails to load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "down" }, false)));
    const container = render(
      <CampusExplorer school={school} spots={[ledge]} initialSpotId={null} />
    );

    click(buttonNamed(container, "All spots"));
    await waitFor(() => {
      expect(container.textContent).toContain("All spots didn’t load.");
    });
    expect(container.textContent).toContain("Ledge");
    expect(buttonNamed(container, "All spots").getAttribute("aria-pressed")).toBe("false");

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ spots: "nope" }));
    click(buttonNamed(container, "Retry"));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
    expect(container.textContent).toContain("All spots didn’t load.");

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ spots: [rail] }));
    click(buttonNamed(container, "Retry"));
    await waitFor(() => {
      expect(container.textContent).toContain("Virginia Tech");
    });
    expect(container.textContent).not.toContain("All spots didn’t load.");
  });

  it("closes a spot from another school when returning to this campus", async () => {
    window.history.replaceState(null, "", `/school/${school.id}?spots=all`);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ spots: [ledge, rail] })));
    const container = render(
      <CampusExplorer school={school} spots={[ledge]} initialSpotId={null} startWithAllSpots />
    );

    await waitFor(() => {
      expect(container.textContent).toContain("This school");
    });

    const railButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Rail")
    );

    if (!(railButton instanceof HTMLButtonElement)) {
      throw new Error("Rail row missing.");
    }

    click(railButton);
    expect(container.textContent).toContain("Big stair");
    expect(container.textContent).toContain("Virginia Tech");
    expect(window.location.search).toBe(`?spots=all&spot=${rail.id}`);

    click(buttonNamed(container, "This school"));
    expect(container.querySelector("article")).toBeNull();
    expect(container.textContent).not.toContain("Big stair");
    expect(window.location.search).toBe("?spots=all");
    expect(container.textContent).toContain("Ledge");
  });

  it("shows an empty list when every campus has no spots", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ spots: [] })));
    const container = render(
      <CampusExplorer school={school} spots={[ledge]} initialSpotId={null} startWithAllSpots />
    );

    await waitFor(() => {
      expect(container.textContent).toContain("No spots yet.");
    });
    expect(container.textContent).toContain("0 spots");
  });
});
