import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));

vi.mock("../../../lib/supabase-server", () => ({ getSupabaseAdmin }));

import { POST } from "./route";

const email = "skater@example.test";
let fetchMock: ReturnType<typeof vi.fn>;

function requestWith(body: string, ip: string) {
  return new Request("https://landing.example.test/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body,
  });
}

function mockSupabase(result: { data?: boolean | null; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  getSupabaseAdmin.mockReturnValue({ rpc } as never);
  return rpc;
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("SUBSCRIPTION_DISPATCH_SECRET", "test-dispatch-secret");
  vi.stubEnv("WAITLIST_RATE_LIMIT_MAX_REQUESTS", "5");
  vi.stubEnv("WAITLIST_RATE_LIMIT_WINDOW_MS", "60000");
  getSupabaseAdmin.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/subscribe", () => {
  it("rejects invalid request bodies without calling Supabase", async () => {
    const response = await POST(requestWith("not json", "198.51.100.1"));

    expect(response.status).toBe(400);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("normalizes a synthetic email and dispatches confirmation after subscription", async () => {
    const rpc = mockSupabase({ data: null, error: null });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await POST(requestWith(JSON.stringify({ email: "  SKATER@EXAMPLE.TEST " }), "198.51.100.2"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("subscribe_email", { p_email: email });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns a server error when Supabase rejects the subscription", async () => {
    mockSupabase({ data: null, error: new Error("Subscription failed") });

    const response = await POST(requestWith(JSON.stringify({ email }), "198.51.100.3"));

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not dispatch when the synthetic dispatch configuration is incomplete", async () => {
    mockSupabase({ data: null, error: null });
    vi.stubEnv("SUBSCRIPTION_DISPATCH_SECRET", "");

    const response = await POST(requestWith(JSON.stringify({ email }), "198.51.100.4"));

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a server error when confirmation dispatch rejects the request", async () => {
    mockSupabase({ data: null, error: null });
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    const response = await POST(requestWith(JSON.stringify({ email }), "198.51.100.5"));

    expect(response.status).toBe(500);
  });

  it("returns a server error when confirmation dispatch throws", async () => {
    mockSupabase({ data: null, error: null });
    fetchMock.mockRejectedValue(new Error("Network unavailable"));

    const response = await POST(requestWith(JSON.stringify({ email }), "198.51.100.6"));

    expect(response.status).toBe(500);
  });

  it("rate limits repeated requests from the same address", async () => {
    vi.stubEnv("WAITLIST_RATE_LIMIT_MAX_REQUESTS", "1");
    mockSupabase({ data: null, error: null });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const request = () => requestWith(JSON.stringify({ email }), "203.0.113.10");

    await POST(request());
    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("returns a generic server error for unexpected subscription errors", async () => {
    getSupabaseAdmin.mockImplementationOnce(() => {
      throw new Error("Unexpected error");
    });

    const response = await POST(requestWith(JSON.stringify({ email }), "198.51.100.7"));

    expect(response.status).toBe(500);
  });
});
