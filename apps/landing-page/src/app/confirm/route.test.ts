import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));

vi.mock("../../lib/supabase-server", () => ({ getSupabaseAdmin }));

import { GET } from "./route";

const token = "00000000-0000-4000-8000-000000000001";

function confirmationRequest(value?: string) {
  const suffix = value ? `?token=${value}` : "";
  return new Request(`https://landing.example.test/confirm${suffix}`);
}

function mockSupabase(result: { data: boolean | null; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  getSupabaseAdmin.mockReturnValue({ rpc } as never);
  return rpc;
}

beforeEach(() => getSupabaseAdmin.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("GET /confirm", () => {
  it("returns the generic invalid response without calling Supabase for a missing token", async () => {
    const response = await GET(confirmationRequest());

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toContain("This confirmation link is invalid or expired.");
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("confirms a valid synthetic token", async () => {
    const rpc = mockSupabase({ data: true, error: null });
    const response = await GET(confirmationRequest(token));

    expect(await response.text()).toContain("Your email is confirmed.");
    expect(rpc).toHaveBeenCalledWith("confirm_subscription", { p_token: token });
  });

  it("does not accept an invalid token format", async () => {
    const response = await GET(confirmationRequest("not-a-token"));

    expect(await response.text()).toContain("This confirmation link is invalid or expired.");
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns the generic response when the token is not confirmed", async () => {
    mockSupabase({ data: false, error: null });

    const response = await GET(confirmationRequest(token));

    expect(await response.text()).toContain("This confirmation link is invalid or expired.");
  });

  it("returns the generic response when Supabase returns an error", async () => {
    mockSupabase({ data: null, error: new Error("Confirmation failed") });

    const response = await GET(confirmationRequest(token));

    expect(await response.text()).toContain("This confirmation link is invalid or expired.");
  });

  it("returns the generic response when confirmation throws", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("Network unavailable"));
    getSupabaseAdmin.mockReturnValue({ rpc } as never);

    const response = await GET(confirmationRequest(token));

    expect(await response.text()).toContain("This confirmation link is invalid or expired.");
  });
});
