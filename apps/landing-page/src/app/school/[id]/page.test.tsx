// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render, waitFor } from "../../../test/react-dom";
import type { CampusSchool, CampusSpot } from "../../../lib/campus";

vi.mock("next/image", () => ({
  default: () => null,
}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const { getSchool, getSchoolSpots } = vi.hoisted(() => ({
  getSchool: vi.fn(),
  getSchoolSpots: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound }));

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockCampusMap() {
      return <div aria-label="Campus map" />;
    },
}));

vi.mock("server-only", () => ({}));

vi.mock("../../../lib/campus-data", () => ({
  getSchool,
  getSchoolSpots,
}));

import SchoolPage, { generateMetadata } from "./page";

const schoolId = "11111111-1111-4111-8111-111111111111";
const spotId = "22222222-2222-4222-8222-222222222222";

const school: CampusSchool = {
  id: schoolId,
  name: "George Mason University",
  city: "Fairfax",
  state: "VA",
  lat: 38.83,
  lng: -77.3,
  numSpots: 1,
};

const spot: CampusSpot = {
  id: spotId,
  name: "Ledge",
  description: "Waxed",
  latitude: 38.831,
  longitude: -77.307,
  imageUrl: null,
  likeCount: 2,
  creatorUsername: "ada",
};

afterEach(() => {
  cleanup();
  notFound.mockClear();
  getSchool.mockReset();
  getSchoolSpots.mockReset();
});

function pageProps(
  id: string,
  spotParam?: string | string[]
): {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ spot?: string | string[] }>;
} {
  return {
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(spotParam === undefined ? {} : { spot: spotParam }),
  };
}

describe("school page", () => {
  it("titles the page with the school name", async () => {
    getSchool.mockResolvedValue(school);

    await expect(generateMetadata(pageProps(schoolId))).resolves.toMatchObject({
      title: "George Mason University skate spots — SkateU",
      description: "Skate spots at George Mason University in Fairfax, VA.",
    });
    await expect(generateMetadata(pageProps("nope"))).resolves.toMatchObject({
      title: "School — SkateU",
    });

    getSchool.mockResolvedValue(null);
    await expect(generateMetadata(pageProps(schoolId))).resolves.toMatchObject({
      title: "School — SkateU",
    });

    getSchool.mockRejectedValue(new Error("down"));
    await expect(generateMetadata(pageProps(schoolId))).resolves.toMatchObject({
      title: "School — SkateU",
    });
  });

  it("renders the campus and a shared spot", async () => {
    getSchool.mockResolvedValue(school);
    getSchoolSpots.mockResolvedValue([spot]);
    const container = render(await SchoolPage(pageProps(schoolId, [spotId])));

    expect(container.textContent).toContain("George Mason University");
    expect(container.textContent).toContain("Ledge");
    expect(container.textContent).toContain("Waxed");
    expect(
      [...container.querySelectorAll("header a")].some((link) => link.textContent === "Search")
    ).toBe(true);
    expect(container.querySelector("footer")?.className).toContain("hidden");
    expect(container.firstElementChild?.className).toContain("h-dvh");
  });

  it("rejects an unknown school id", async () => {
    await expect(SchoolPage(pageProps("not-a-school"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getSchool).not.toHaveBeenCalled();
  });

  it("rejects a school that is not in the database", async () => {
    getSchool.mockResolvedValue(null);

    await expect(SchoolPage(pageProps(schoolId))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getSchoolSpots).not.toHaveBeenCalled();
  });

  it("shows a recovery message when the school or spots cannot be loaded", async () => {
    getSchool.mockRejectedValue(new Error("down"));
    const schoolFailure = render(await SchoolPage(pageProps(schoolId)));

    expect(schoolFailure.textContent).toContain("This campus didn’t load.");
    expect(schoolFailure.textContent).toContain("Back to search");

    cleanup();
    getSchool.mockResolvedValue(school);
    getSchoolSpots.mockRejectedValue(new Error("down"));
    const spotFailure = render(await SchoolPage(pageProps(schoolId)));

    expect(spotFailure.textContent).toContain("This campus didn’t load.");
  });

  it("opens every spot when the map link asks for them", async () => {
    getSchool.mockResolvedValue(school);
    getSchoolSpots.mockResolvedValue([spot]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          spots: [
            spot,
            {
              id: "33333333-3333-4333-8333-333333333333",
              name: "Rail",
              description: "",
              latitude: 37.2,
              longitude: -80.4,
              imageUrl: null,
              likeCount: 0,
              creatorUsername: null,
              schoolName: "Virginia Tech",
            },
          ],
        }),
      })
    );

    const container = render(
      await SchoolPage({
        params: Promise.resolve({ id: schoolId }),
        searchParams: Promise.resolve({ spots: ["all"] }),
      })
    );

    await waitFor(() => {
      expect(container.textContent).toContain("This school");
    });
    expect(container.textContent).toContain("Virginia Tech");
    expect(fetch).toHaveBeenCalledWith("/api/spots");
    vi.unstubAllGlobals();
  });
});
