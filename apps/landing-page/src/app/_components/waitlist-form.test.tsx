// @vitest-environment jsdom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WAITLIST_EMAIL_STORAGE_KEY } from "../../constants/site";
import { change, click, cleanup, render, submit, waitFor } from "../../test/react-dom";
import { WaitlistForm } from "./waitlist-form";

const email = "skater@example.test";
const subscribeBody = {
  email,
  confirmedAge13Plus: true,
};
let fetchMock: ReturnType<typeof vi.fn>;

function emailInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector("input[name=email]");

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Email input is unavailable.");
  }

  return input;
}

function ageCheckbox(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector("input[name=confirmedAge13Plus]");

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Age confirmation checkbox is unavailable.");
  }

  return input;
}

function checkAge(container: HTMLElement): void {
  const input = ageCheckbox(container);

  act(() => {
    input.click();
  });
}

function form(container: HTMLElement): HTMLFormElement {
  const waitlistForm = container.querySelector("form");

  if (!(waitlistForm instanceof HTMLFormElement)) {
    throw new Error("Waitlist form is unavailable.");
  }

  return waitlistForm;
}

function submitButton(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector('button[type="submit"]');

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("Submit button is unavailable.");
  }

  return button;
}

function resendButton(container: HTMLElement): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((item) =>
    item.textContent?.includes("Resend confirmation email")
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("Resend button is unavailable.");
  }

  return button;
}

function jsonOk(emailSent = true): Response {
  return new Response(JSON.stringify({ success: true, emailSent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
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
  it("renders the default Android beta prompt", () => {
    const container = render(<WaitlistForm />);

    expect(emailInput(container).required).toBe(true);
    expect(ageCheckbox(container).required).toBe(true);
    expect(form(container).getAttribute("aria-label")).toBe(
      "Request Android beta access"
    );
    expect(container.textContent).toContain("You must be 13 or older.");
  });

  it("does not submit without a 13+ confirmation", () => {
    const container = render(<WaitlistForm />);

    change(emailInput(container), email);
    submit(form(container));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      "You must be at least 13 years old to request Android beta access."
    );
  });

  it("submits a normalized synthetic email and stores it after success", async () => {
    fetchMock.mockResolvedValue(jsonOk());
    const container = render(<WaitlistForm />);
    const input = emailInput(container);

    change(input, "  SKATER@EXAMPLE.TEST ");
    checkAge(container);
    submit(form(container));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscribeBody),
    });
    await waitFor(() => expect(container.textContent).toContain("We saved your email."));
    expect(window.localStorage.getItem(WAITLIST_EMAIL_STORAGE_KEY)).toBe(email);
    expect(input.value).toBe("");
    expect(resendButton(container).textContent).toContain("Resend confirmation email");
  });

  it("lets the user resend a confirmation email", async () => {
    fetchMock.mockResolvedValue(jsonOk());
    const container = render(<WaitlistForm />);

    change(emailInput(container), email);
    checkAge(container);
    submit(form(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    click(resendButton(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(container.textContent).toContain("Confirmation email sent.")
    );
  });

  it("says so when the confirmation email did not send", async () => {
    fetchMock.mockResolvedValue(jsonOk(false));
    const container = render(<WaitlistForm />);

    change(emailInput(container), email);
    checkAge(container);
    submit(form(container));

    await waitFor(() =>
      expect(container.textContent).toContain("confirmation email didn’t send")
    );
    expect(resendButton(container)).toBeTruthy();
  });

  it("does not submit an email that is already stored on this device", () => {
    window.localStorage.setItem(WAITLIST_EMAIL_STORAGE_KEY, email);
    const container = render(<WaitlistForm />);

    expect(container.textContent).toContain("We already have this email");
    expect(resendButton(container).textContent).toContain("Resend confirmation email");
    change(emailInput(container), email);
    submit(form(container));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("We already have this email");
  });

  it("shows an error when the request fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const container = render(<WaitlistForm />);

    change(emailInput(container), email);
    checkAge(container);
    submit(form(container));

    await waitFor(() => expect(container.textContent).toContain("couldn’t save your email"));
    expect(container.textContent).not.toContain(email);
  });

  it("shows a rate-limit message", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));
    const container = render(<WaitlistForm />);

    change(emailInput(container), email);
    checkAge(container);
    submit(form(container));

    await waitFor(() => expect(container.textContent).toContain("Too many tries"));
  });

  it("keeps the success message when local storage is unavailable", async () => {
    fetchMock.mockResolvedValue(jsonOk());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    const container = render(<WaitlistForm />);

    change(emailInput(container), email);
    checkAge(container);
    submit(form(container));

    await waitFor(() => expect(container.textContent).toContain("We saved your email."));
  });

  it("disables controls while a request is pending", async () => {
    let resolveResponse!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })
    );
    const container = render(<WaitlistForm />);
    const input = emailInput(container);
    const button = submitButton(container);

    change(input, email);
    checkAge(container);
    submit(form(container));
    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
    resolveResponse(jsonOk());
    await waitFor(() => expect(button.disabled).toBe(false));
  });
});
