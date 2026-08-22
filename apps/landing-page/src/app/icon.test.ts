import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appDir = import.meta.dirname;

function pngColorType(filename: string): number {
  const bytes = readFileSync(join(appDir, filename));
  return bytes[25] ?? -1;
}

describe("landing page icons", () => {
  it("uses a transparent pink pin for the tab icon", () => {
    expect(readFileSync(join(appDir, "icon.svg"), "utf8")).toContain("viewBox=\"227 216 570 570\"");
    expect(readFileSync(join(appDir, "icon.svg"), "utf8")).not.toContain("fill=\"#fff");
    expect(pngColorType("icon.png")).toBe(6);
    expect(pngColorType("apple-icon.png")).toBe(6);
  });
});
