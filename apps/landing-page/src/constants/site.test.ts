import { describe, expect, it } from "vitest";

import { SITE_DESCRIPTION, SITE_TITLE } from "./site";

describe("site copy", () => {
  it("uses the landing-page title", () => {
    expect(SITE_TITLE).toBe("SkateU — Every school is a skatepark.");
    expect(SITE_DESCRIPTION).toContain("campus");
    expect(SITE_TITLE).not.toContain("Land tricks");
  });
});
