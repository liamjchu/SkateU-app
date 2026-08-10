// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { change, cleanup, render, submit, waitFor } from "../../test/react-dom";
import { WaitlistForm } from "./waitlist-form";

const email = "skater@example.test";
let fetchMock: ReturnType<typeof vi.fn>;

function emailInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector("input[name=email]");

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Email input is unavailable.");
  }

  return input;
}

function form(container: HTMLElement): HTMLFormElement {
  const waitlistForm = container.querySelector("form");

  if (!(waitlistForm instanceof HTMLFormElement)) {
    throw new Error("Waitlist form is unavailable.");
  }

  return waitlistForm;
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("WaitlistForm", () => {
  it("renders the default waitlist prompt", () => {
    const container = render(<WaitlistForm />);

    expect(emailInput(container).required).toBe(true);
    expect(container.textContent).toContain("No spam. Just the invite when we drop.");
  });

  it("submits a normalized synthetic email", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const container = render(<WaitlistForm />);
    const input = emailInput(container);

    change(input, "  SKATER@EXAMPLE.TEST ");
    submit(form(container));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    await waitFor(() => expect(container.textContent).toContain("You’re subscribed."));
    expect(input.value).toBe("");
  });

  it("submits an email even when a stale local value exists", async () => {
    window.localStorage.setItem("skateu.waitlistEmail", email);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const container = render(<WaitlistForm />);

    change(emailInput(container), email);
    submit(form(container));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  });

  it("shows an error when the request fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const container = render(<WaitlistForm />);

    change(emailInput(container), email);
    submit(form(container));

    await waitFor(() => expect(container.textContent).toContain("couldn’t add you"));
  });


  it("disables controls while a request is pending", async () => {
    let resolveResponse!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    const container = render(<WaitlistForm />);
    const input = emailInput(container);
    const button = container.querySelector("button") as HTMLButtonElement;

    change(input, email);
    submit(form(container));
    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
    resolveResponse(new Response(null, { status: 200 }));
    await waitFor(() => expect(button.disabled).toBe(false));
  });
});
