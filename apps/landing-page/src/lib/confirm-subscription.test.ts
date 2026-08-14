import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));

vi.mock("./supabase-server", () => ({ getSupabaseAdmin }));

import {
  confirmSubscription,
  waitlistTokenFromSearchParam,
} from "./confirm-subscription";

const token = "00000000-0000-4000-8000-000000000001";

function mockSupabase(result: { data: boolean | null; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  getSupabaseAdmin.mockReturnValue({ rpc } as never);
  return rpc;
}

beforeEach(() => getSupabaseAdmin.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("waitlistTokenFromSearchParam", () => {
  it("accepts a valid token", () => {
    expect(waitlistTokenFromSearchParam(token)).toBe(token);
  });

  it("rejects missing, array, and malformed tokens", () => {
    expect(waitlistTokenFromSearchParam(undefined)).toBeNull();
    expect(waitlistTokenFromSearchParam([token])).toBeNull();
    expect(waitlistTokenFromSearchParam("not-a-token")).toBeNull();
  });
});

describe("confirmSubscription", () => {
  it("does not call Supabase without a token", async () => {
    await expect(confirmSubscription(null)).resolves.toBe(false);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("confirms a valid synthetic token", async () => {
    const rpc = mockSupabase({ data: true, error: null });

    await expect(confirmSubscription(token)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("confirm_subscription", { p_token: token });
  });

  it("returns false when the token is not confirmed", async () => {
    mockSupabase({ data: false, error: null });

    await expect(confirmSubscription(token)).resolves.toBe(false);
  });

  it("returns false when Supabase returns an error", async () => {
    mockSupabase({ data: null, error: new Error("Confirmation failed") });

    await expect(confirmSubscription(token)).resolves.toBe(false);
  });

  it("returns false when confirmation throws", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("Network unavailable"));
    getSupabaseAdmin.mockReturnValue({ rpc } as never);

    await expect(confirmSubscription(token)).resolves.toBe(false);
  });
});
