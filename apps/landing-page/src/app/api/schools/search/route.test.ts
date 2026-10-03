import { beforeEach, describe, expect, it, vi } from "vitest";

const { searchSchools } = vi.hoisted(() => ({
  searchSchools: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/campus-data", () => ({ searchSchools }));

import { GET } from "./route";

const schoolId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  searchSchools.mockReset();
});

describe("GET /api/schools/search", () => {
  it("returns no schools until the query has two characters", async () => {
    const response = await GET(new Request("https://skateu.app/api/schools/search?q=%20g%20"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ schools: [] });
    expect(searchSchools).not.toHaveBeenCalled();
  });

  it("returns name and place for each school", async () => {
    searchSchools.mockResolvedValue([
      {
        id: schoolId,
        name: "George Mason University",
        city: "Fairfax",
        state: "VA",
        lat: 38.83,
        lng: -77.3,
        numSpots: 2,
      },
    ]);

    const response = await GET(new Request("https://skateu.app/api/schools/search?q=mason"));

    expect(searchSchools).toHaveBeenCalledWith("mason");
    expect(await response.json()).toEqual({
      schools: [
        {
          id: schoolId,
          name: "George Mason University",
          city: "Fairfax",
          state: "VA",
        },
      ],
    });
  });

  it("returns a search error when the lookup fails", async () => {
    searchSchools.mockRejectedValue(new Error("down"));

    const response = await GET(new Request("https://skateu.app/api/schools/search?q=mason"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "School search is unavailable." });
  });
});
