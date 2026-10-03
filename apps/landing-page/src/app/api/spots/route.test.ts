import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAllSpots } = vi.hoisted(() => ({
  getAllSpots: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/campus-data", () => ({ getAllSpots }));

import { GET } from "./route";

const spotId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  getAllSpots.mockReset();
});

describe("GET /api/spots", () => {
  it("returns every visible spot", async () => {
    const spots = [
      {
        id: spotId,
        name: "Ledge",
        description: "Waxed",
        latitude: 38.8,
        longitude: -77.3,
        imageUrl: null,
        likeCount: 1,
        creatorUsername: "ada",
        schoolName: "George Mason University",
      },
    ];
    getAllSpots.mockResolvedValue(spots);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ spots });
  });

  it("returns an error when the lookup fails", async () => {
    getAllSpots.mockRejectedValue(new Error("down"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Spots are unavailable." });
  });
});
