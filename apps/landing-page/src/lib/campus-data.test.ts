import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CampusDataError, getAllSpots, getPopularSchool, getSchool, getSchoolSpots, searchSchools } from "./campus-data";

const schoolId = "11111111-1111-4111-8111-111111111111";
const spotId = "22222222-2222-4222-8222-222222222222";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("campus data", () => {
  it("searches through the schools RPC", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([
        {
          id: schoolId,
          name: "George Mason University",
          city: "Fairfax",
          state: "VA",
          latitude: 38.83,
          longitude: -77.3,
          numspots: 2,
        },
        { id: "skip-me" },
      ])
    );

    const schools = await searchSchools("  george mason  ");
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    const request = new Request(url, init);

    expect(schools).toHaveLength(1);
    expect(schools[0]?.name).toBe("George Mason University");
    expect(request.url).toBe("https://supabase.example.test/rest/v1/rpc/search_schools");
    expect(request.method).toBe("POST");
    expect(request.headers.get("apikey")).toBe("service-role");
    expect(request.headers.get("authorization")).toBe("Bearer service-role");
    expect(await request.json()).toEqual({
      p_query: "george mason",
      p_types: null,
      p_limit: 20,
    });
  });

  it("does not call the network for a short search", async () => {
    await expect(searchSchools(" g ")).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("limits a very long search", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

    await searchSchools("m".repeat(100));
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String(init?.body)) as { p_query: string };

    expect(body.p_query).toHaveLength(80);
  });

  it("loads one school and its visible spots", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: schoolId,
            name: "George Mason University",
            city: "Fairfax",
            state: "VA",
            latitude: 38.83,
            longitude: -77.3,
            numspots: 1,
          },
        ])
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: spotId,
            name: "Ledge",
            description: "Waxed",
            status: "active",
            latitude: 38.8,
            longitude: -77.3,
            image_urls: ["https://cdn.example/ledge.jpg"],
            likes_count: 4,
            creator: { username: "ada" },
          },
          {
            id: "33333333-3333-4333-8333-333333333333",
            name: "Removed",
            status: "removed",
            latitude: 1,
            longitude: 2,
          },
        ])
      );

    const school = await getSchool(schoolId);
    const spots = await getSchoolSpots(schoolId);
    const schoolUrl = String(vi.mocked(fetch).mock.calls[0][0]);
    const spotUrl = String(vi.mocked(fetch).mock.calls[1][0]);

    expect(school?.name).toBe("George Mason University");
    expect(spots.map((spot) => spot.name)).toEqual(["Ledge"]);
    expect(schoolUrl).toContain(`/rest/v1/schools?id=eq.${schoolId}`);
    expect(spotUrl).toContain(`school_id=eq.${schoolId}`);
    expect(spotUrl).toContain("status=in.%28active%2Cunder_review%29");
    expect(spotUrl).toContain("order=name.asc");
    expect(spotUrl).toContain("schools%28name%29");
  });

  it("loads the most popular school and every visible spot", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: schoolId,
            name: "George Mason University",
            city: "Fairfax",
            state: "VA",
            latitude: 38.83,
            longitude: -77.3,
            numspots: 23,
          },
        ])
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: spotId,
            name: "Ledge",
            description: "Waxed",
            status: "active",
            latitude: 38.8,
            longitude: -77.3,
            likes_count: 4,
            schools: { name: "George Mason University" },
          },
        ])
      );

    await expect(getPopularSchool()).resolves.toBeNull();
    const school = await getPopularSchool();
    const spots = await getAllSpots();
    const popularUrl = String(vi.mocked(fetch).mock.calls[1][0]);
    const spotsUrl = String(vi.mocked(fetch).mock.calls[2][0]);

    expect(school?.name).toBe("George Mason University");
    expect(spots[0]?.schoolName).toBe("George Mason University");
    expect(popularUrl).toContain("order=numspots.desc%2Cid.asc");
    expect(popularUrl).toContain("limit=1");
    expect(spotsUrl).toContain("limit=5000");
    expect(spotsUrl).toContain("status=in.%28active%2Cunder_review%29");
    expect(spotsUrl).not.toContain("school_id=");
  });

  it("returns null when the school id or row is missing", async () => {
    await expect(getSchool("not-an-id")).resolves.toBeNull();
    await expect(getSchoolSpots("not-an-id")).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();

    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
    await expect(getSchool(schoolId)).resolves.toBeNull();
  });

  it("fails when the database is not configured or the response is bad", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(searchSchools("mason")).rejects.toBeInstanceOf(CampusDataError);

    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "nope" }, false));
    await expect(getSchool(schoolId)).rejects.toThrow("School data is unavailable.");

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("bad json");
      },
    } as unknown as Response);
    await expect(getSchoolSpots(schoolId)).rejects.toThrow("School data could not be read.");

    vi.mocked(fetch).mockResolvedValue(jsonResponse({ schools: [] }));
    await expect(searchSchools("mason")).rejects.toThrow("School data could not be read.");
  });
});
