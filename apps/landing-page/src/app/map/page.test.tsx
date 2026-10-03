// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../../test/react-dom";
import type { CampusSchool } from "../../lib/campus";

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("server-only", () => ({}));

const { getPopularSchool } = vi.hoisted(() => ({
  getPopularSchool: vi.fn(),
}));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("../../lib/campus-data", () => ({ getPopularSchool }));

import MapPage from "./page";

const school: CampusSchool = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "George Mason University",
  city: "Fairfax",
  state: "VA",
  lat: 38.83,
  lng: -77.3,
  numSpots: 23,
};

afterEach(() => {
  cleanup();
  getPopularSchool.mockReset();
  redirect.mockClear();
});

describe("map page", () => {
  it("opens the most popular campus with every spot", async () => {
    getPopularSchool.mockResolvedValue(school);

    await expect(MapPage()).rejects.toThrow(
      "NEXT_REDIRECT:/school/11111111-1111-4111-8111-111111111111?spots=all"
    );
    expect(redirect).toHaveBeenCalledWith(
      "/school/11111111-1111-4111-8111-111111111111?spots=all"
    );
  });

  it("shows search when no campus is available", async () => {
    getPopularSchool.mockResolvedValue(null);
    const empty = render(await MapPage());

    expect(empty.textContent).toContain("Map isn’t available right now.");
    expect(empty.querySelector('input[placeholder="Search all schools..."]')).not.toBeNull();

    cleanup();
    getPopularSchool.mockRejectedValue(new Error("down"));
    const failed = render(await MapPage());

    expect(failed.textContent).toContain("Map isn’t available right now.");
    expect(redirect).not.toHaveBeenCalled();
  });
});
