import { describe, expect, it } from "vitest";

import {
  formatPlace,
  isSchoolId,
  mapSchoolRow,
  mapSpotRow,
  readClientSpots,
  readSpotId,
  showsAllSpots,
  spotCountLabel,
} from "./campus";

const schoolId = "11111111-1111-4111-8111-111111111111";
const spotId = "22222222-2222-4222-8222-222222222222";

describe("campus helpers", () => {
  it("accepts school UUIDs and rejects everything else", () => {
    expect(isSchoolId(schoolId)).toBe(true);
    expect(isSchoolId(schoolId.toUpperCase())).toBe(true);
    expect(isSchoolId("george-mason")).toBe(false);
    expect(isSchoolId("")).toBe(false);
  });

  it("formats a city and state", () => {
    expect(formatPlace("Fairfax", "VA")).toBe("Fairfax, VA");
    expect(formatPlace("Fairfax", "")).toBe("Fairfax");
    expect(formatPlace("", "VA")).toBe("VA");
  });

  it("labels spot counts", () => {
    expect(spotCountLabel(0)).toBe("0 spots");
    expect(spotCountLabel(1)).toBe("1 spot");
    expect(spotCountLabel(4)).toBe("4 spots");
  });

  it("reads a spot id from a query param", () => {
    expect(readSpotId(spotId)).toBe(spotId);
    expect(readSpotId([spotId, schoolId])).toBe(spotId);
    expect(readSpotId("not-an-id")).toBeNull();
    expect(readSpotId(undefined)).toBeNull();
    expect(readSpotId([])).toBeNull();
  });

  it("maps a school row and drops incomplete ones", () => {
    expect(
      mapSchoolRow({
        id: `  ${schoolId}  `,
        name: " George Mason University ",
        city: "Fairfax",
        state: "VA",
        latitude: 38.83,
        longitude: -77.3,
        numspots: 3.9,
      })
    ).toEqual({
      id: schoolId,
      name: "George Mason University",
      city: "Fairfax",
      state: "VA",
      lat: 38.83,
      lng: -77.3,
      numSpots: 3,
    });

    expect(mapSchoolRow(null)).toBeNull();
    expect(mapSchoolRow({ id: "nope", name: "A", city: "B", state: "C", latitude: 1, longitude: 2 })).toBeNull();
    expect(mapSchoolRow({ id: schoolId, name: " ", city: "B", state: "C", latitude: 1, longitude: 2 })).toBeNull();
    expect(mapSchoolRow({ id: schoolId, name: "A", city: "", state: "C", latitude: 1, longitude: 2 })).toBeNull();
    expect(mapSchoolRow({ id: schoolId, name: "A", city: "B", state: "", latitude: 1, longitude: 2 })).toBeNull();
    expect(mapSchoolRow({ id: schoolId, name: "A", city: "B", state: "C", latitude: 91, longitude: 2 })).toBeNull();
    expect(mapSchoolRow({ id: schoolId, name: "A", city: "B", state: "C", latitude: 1, longitude: -181 })).toBeNull();
    expect(mapSchoolRow({ id: schoolId, name: "A", city: "B", state: "C", latitude: Number.NaN, longitude: 2 })).toBeNull();
    expect(
      mapSchoolRow({ id: schoolId, name: "A", city: "B", state: "C", latitude: 1, longitude: 2, numspots: -1 })
        ?.numSpots
    ).toBe(0);
  });

  it("maps visible spots and keeps the first https photo", () => {
    expect(
      mapSpotRow({
        id: spotId,
        name: " Ledge ",
        description: "Waxed",
        status: "active",
        latitude: 38.8,
        longitude: -77.3,
        image_urls: ["not a url", "http://insecure.example/a.jpg", "https://cdn.example/spot.jpg"],
        likes_count: 2,
        creator: { username: " skater " },
        schools: { name: " George Mason University " },
      })
    ).toMatchObject({
      id: spotId,
      name: "Ledge",
      description: "Waxed",
      imageUrl: "https://cdn.example/spot.jpg",
      likeCount: 2,
      creatorUsername: "skater",
      schoolName: "George Mason University",
    });

    expect(
      mapSpotRow({
        id: spotId,
        name: "Gap",
        status: "under_review",
        latitude: 1,
        longitude: 2,
        image_urls: [1, ""],
        likes_count: "4",
        creator: [{ username: "ada" }],
      })
    ).toMatchObject({
      imageUrl: null,
      likeCount: 0,
      description: "",
      creatorUsername: "ada",
    });

    expect(mapSpotRow({ id: spotId, name: "Hidden", status: "removed", latitude: 1, longitude: 2 })).toBeNull();
    expect(mapSpotRow({ id: spotId, name: "Pending", status: "pending_moderation", latitude: 1, longitude: 2 })).toBeNull();
    expect(mapSpotRow({ id: spotId, name: "Mystery", latitude: 1, longitude: 2 })).toBeNull();
    expect(mapSpotRow("spot")).toBeNull();
    expect(mapSpotRow({ id: "bad", name: "Gap", status: "active", latitude: 1, longitude: 2 })).toBeNull();
    expect(mapSpotRow({ id: spotId, name: " ", status: "active", latitude: 1, longitude: 2 })).toBeNull();
    expect(mapSpotRow({ id: spotId, name: "Gap", status: "active", latitude: "1", longitude: 2 })).toBeNull();
    expect(mapSpotRow({ id: spotId, name: "Gap", status: "active", latitude: 1, longitude: 2, creator: null })?.creatorUsername).toBeNull();
    expect(mapSpotRow({ id: spotId, name: "Gap", status: "active", latitude: 1, longitude: 2, creator: { username: " " } })?.creatorUsername).toBeNull();
    expect(mapSpotRow({ id: spotId, name: "Gap", status: "active", latitude: 1, longitude: 2, creator: [] })?.creatorUsername).toBeNull();
    expect(mapSpotRow({ id: spotId, name: "Gap", status: "active", latitude: 1, longitude: 2, image_urls: "https://cdn.example/a.jpg" })?.imageUrl).toBeNull();
    expect(
      mapSpotRow({
        id: spotId,
        name: "Gap",
        status: "active",
        latitude: 1,
        longitude: 2,
        schools: [{ name: "Virginia Tech" }],
      })?.schoolName
    ).toBe("Virginia Tech");
    expect(mapSpotRow({ id: spotId, name: "Gap", status: "active", latitude: 1, longitude: 2, schools: { name: " " } })?.schoolName).toBeNull();
    expect(mapSpotRow({ id: spotId, name: "Gap", status: "active", latitude: 1, longitude: 2, schools: null })?.schoolName).toBeNull();
  });

  it("reads the all-spots payload and the spots query", () => {
    expect(showsAllSpots("all")).toBe(true);
    expect(showsAllSpots(["all"])).toBe(true);
    expect(showsAllSpots(["school", "all"])).toBe(false);
    expect(showsAllSpots(undefined)).toBe(false);

    expect(readClientSpots({ spots: [] })).toEqual([]);
    expect(
      readClientSpots([
        {
          id: spotId,
          name: " Ledge ",
          description: "Waxed",
          latitude: 38.8,
          longitude: -77.3,
          imageUrl: "https://cdn.example/ledge.jpg",
          likeCount: 2,
          creatorUsername: "ada",
          schoolName: "George Mason University",
        },
        { name: "skip" },
        {
          id: spotId,
          name: "Gap",
          latitude: 1,
          longitude: 2,
          imageUrl: "http://insecure.example/a.jpg",
          likeCount: -1,
          creatorUsername: " ",
        },
      ])
    ).toEqual([
      {
        id: spotId,
        name: "Ledge",
        description: "Waxed",
        latitude: 38.8,
        longitude: -77.3,
        imageUrl: "https://cdn.example/ledge.jpg",
        likeCount: 2,
        creatorUsername: "ada",
        schoolName: "George Mason University",
      },
      {
        id: spotId,
        name: "Gap",
        description: "",
        latitude: 1,
        longitude: 2,
        imageUrl: null,
        likeCount: 0,
        creatorUsername: null,
        schoolName: null,
      },
    ]);
  });
});
