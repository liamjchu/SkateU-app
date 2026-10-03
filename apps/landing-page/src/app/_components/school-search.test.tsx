// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { change, cleanup, click, render } from "../../test/react-dom";
import { SchoolSearch } from "./school-search";

const schoolId = "11111111-1111-4111-8111-111111111111";
const school = {
  id: schoolId,
  name: "George Mason University",
  city: "Fairfax",
  state: "VA",
};

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

async function settle(ms = 250) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SchoolSearch", () => {
  it("waits for two characters and links to the campus page", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        schools: [school, { id: "not-a-uuid", name: "Skip", city: "X", state: "Y" }, null],
      }) as Response
    );
    const container = render(<SchoolSearch />);
    const input = container.querySelector("input");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Search input missing.");
    }

    change(input, "g");
    await settle(200);
    expect(fetch).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Type at least 2 characters.");

    change(input, "ge");
    await settle(200);
    expect(fetch).not.toHaveBeenCalled();
    await settle(50);

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe(`/school/${schoolId}`);
    expect(link?.textContent).toContain("George Mason University");
    expect(link?.textContent).toContain("Fairfax, VA");
    expect(container.textContent).not.toContain("Skip");

    change(input, "");
    await settle();
    expect(container.textContent).not.toContain("George Mason University");
  });

  it("shows an empty state and retries after a failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ schools: [] }) as Response);
    const container = render(<SchoolSearch />);
    const input = container.querySelector("input");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Search input missing.");
    }

    change(input, "zz");
    await settle();
    expect(container.textContent).toContain("No schools found.");

    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    change(input, "mason");
    await settle();
    expect(container.textContent).toContain("School search is unavailable.");

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ schools: [school] }) as Response);
    const retry = container.querySelector("button");

    if (!(retry instanceof HTMLButtonElement)) {
      throw new Error("Retry button missing.");
    }

    click(retry);
    await settle();
    expect(container.textContent).toContain("George Mason University");
  });

  it("ignores an aborted request and a response that is not a list", async () => {
    let rejectRequest: (error: Error) => void = () => undefined;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        })
    );
    const container = render(<SchoolSearch />);
    const input = container.querySelector("input");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Search input missing.");
    }

    change(input, "ge");
    await settle();
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    change(input, "geo");
    await act(async () => {
      rejectRequest(abortError);
    });
    expect(container.textContent).not.toContain("School search is unavailable.");

    vi.mocked(fetch).mockResolvedValue(jsonResponse({ schools: { name: "nope" } }) as Response);
    await settle();
    expect(container.textContent).toContain("No schools found.");
  });

  it("treats a failed response as an error", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false) as Response);
    const container = render(<SchoolSearch /> as ReactNode);
    const input = container.querySelector("input");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Search input missing.");
    }

    change(input, "gm");
    await settle();
    expect(container.querySelector("[role='alert']")).not.toBeNull();
  });
});
