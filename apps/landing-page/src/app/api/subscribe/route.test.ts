import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WAITLIST_RATE_LIMIT_RPC,
  consumeRateLimitBuckets,
  type RateLimitBucket,
} from "../../../lib/waitlist-rate-limit";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));

vi.mock("../../../lib/supabase-server", () => ({ getSupabaseAdmin }));

import { GET, POST } from "./route";

const email = "skater@example.test";
let fetchMock: ReturnType<typeof vi.fn>;
let rateLimitStore: Map<string, RateLimitBucket>;

function requestWith(
  body: string,
  ip: string,
  headers: HeadersInit = { "Content-Type": "application/json" }
) {
  return new Request("https://landing.example.test/api/subscribe", {
    method: "POST",
    headers: { "x-forwarded-for": ip, ...headers },
    body,
  });
}

function mockSupabase(result: { data?: boolean | null; error: unknown }) {
  const rpc = vi.fn().mockImplementation(async (name: string, args: unknown) => {
    if (name === WAITLIST_RATE_LIMIT_RPC) {
      const params = args as {
        p_keys: string[];
        p_max_requests: number;
        p_window_ms: number;
      };

      const retryAfter = consumeRateLimitBuckets(
        rateLimitStore,
        params.p_keys,
        params.p_max_requests,
        params.p_window_ms,
        Date.now()
      );

      return { data: retryAfter ?? 0, error: null };
    }

    return result;
  });
  getSupabaseAdmin.mockReturnValue({ rpc } as never);
  return rpc;
}

beforeEach(() => {
  fetchMock = vi.fn();
  rateLimitStore = new Map();
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

describe("GET /api/subscribe", () => {
  it("rejects reads so the waitlist cannot be scraped", async () => {
    const response = await GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });
});

describe("POST /api/subscribe", () => {
  it("rejects invalid request bodies without calling Supabase", async () => {
    const response = await POST(requestWith("not json", "198.51.100.1"));

    expect(response.status).toBe(400);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("rejects waitlist signups without a 13+ confirmation", async () => {
    const response = await POST(
      requestWith(JSON.stringify({ email }), "198.51.100.11")
    );

    expect(response.status).toBe(400);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("rejects a string age confirmation", async () => {
    const response = await POST(
      requestWith(
        JSON.stringify({ email, confirmedAge13Plus: "true" }),
        "198.51.100.12"
      )
    );

    expect(response.status).toBe(400);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("rejects header-injection and missing-dot addresses without calling Supabase", async () => {
    const injected = await POST(
      requestWith(
        JSON.stringify({
          email: "skater@example.test\nbcc:other@example.test",
          confirmedAge13Plus: true,
        }),
        "198.51.100.13"
      )
    );
    const missingDot = await POST(
      requestWith(
        JSON.stringify({ email: "skater@localhost", confirmedAge13Plus: true }),
        "198.51.100.14"
      )
    );

    expect(injected.status).toBe(400);
    expect(missingDot.status).toBe(400);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("rejects oversized payloads", async () => {
    const response = await POST(
      requestWith(JSON.stringify({ email, confirmedAge13Plus: true }), "198.51.100.15", {
        "Content-Type": "application/json",
        "Content-Length": "5000",
      })
    );

    expect(response.status).toBe(400);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("normalizes a synthetic email and dispatches confirmation after subscription", async () => {
    const rpc = mockSupabase({ data: null, error: null });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await POST(
      requestWith(
        JSON.stringify({
          email: "  SKATER+CAMPUS@EXAMPLE.TEST ",
          confirmedAge13Plus: true,
        }),
        "198.51.100.2"
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, emailSent: true });
    expect(rpc).toHaveBeenCalledWith(WAITLIST_RATE_LIMIT_RPC, {
      p_keys: ["email:skater+campus@example.test", "abuse:waitlist"],
      p_max_requests: 5,
      p_window_ms: 60_000,
    });
    expect(rpc).toHaveBeenCalledWith("subscribe_email", {
      p_email: "skater+campus@example.test",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const dispatch = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(dispatch.body))).toEqual({
      email: "skater+campus@example.test",
    });
  });

  it("returns a server error when Supabase rejects the subscription", async () => {
    mockSupabase({ data: null, error: new Error("Subscription failed") });

    const response = await POST(
      requestWith(JSON.stringify({ email, confirmedAge13Plus: true }), "198.51.100.3")
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to save your email.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the signup when confirmation dispatch is not configured", async () => {
    mockSupabase({ data: null, error: null });
    vi.stubEnv("SUBSCRIPTION_DISPATCH_SECRET", "");

    const response = await POST(
      requestWith(JSON.stringify({ email, confirmedAge13Plus: true }), "198.51.100.4")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, emailSent: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the signup when confirmation dispatch rejects the request", async () => {
    mockSupabase({ data: null, error: null });
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    const response = await POST(
      requestWith(JSON.stringify({ email, confirmedAge13Plus: true }), "198.51.100.5")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, emailSent: false });
  });

  it("keeps the signup when confirmation dispatch throws", async () => {
    mockSupabase({ data: null, error: null });
    fetchMock.mockRejectedValue(new Error("Network unavailable"));

    const response = await POST(
      requestWith(JSON.stringify({ email, confirmedAge13Plus: true }), "198.51.100.6")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, emailSent: false });
  });

  it("rate limits repeated requests from the same address", async () => {
    vi.stubEnv("WAITLIST_RATE_LIMIT_MAX_REQUESTS", "1");
    const rpc = mockSupabase({ data: null, error: null });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const request = () =>
      requestWith(JSON.stringify({ email, confirmedAge13Plus: true }), "203.0.113.10");

    await POST(request());
    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(rpc.mock.calls.filter(([name]) => name === "subscribe_email")).toHaveLength(
      1
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not let forged x-forwarded-for values bypass the limiter key", async () => {
    vi.stubEnv("WAITLIST_RATE_LIMIT_MAX_REQUESTS", "1");
    const rpc = mockSupabase({ data: null, error: null });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const body = JSON.stringify({ email, confirmedAge13Plus: true });

    await POST(requestWith(body, "198.51.100.1"));
    const blocked = await POST(requestWith(body, "203.0.113.9"));

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(blocked.headers.get("Retry-After")).toBe("60");
    expect(rpc.mock.calls.filter(([name]) => name === "subscribe_email")).toHaveLength(
      1
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(
      rpc.mock.calls.filter(([name]) => name === WAITLIST_RATE_LIMIT_RPC)
    ).toHaveLength(2);
    expect(rpc).toHaveBeenNthCalledWith(1, WAITLIST_RATE_LIMIT_RPC, {
      p_keys: [`email:${email}`, "abuse:waitlist"],
      p_max_requests: 1,
      p_window_ms: 60_000,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, WAITLIST_RATE_LIMIT_RPC, {
      p_keys: [`email:${email}`, "abuse:waitlist"],
      p_max_requests: 1,
      p_window_ms: 60_000,
    });
  });

  it("does not call subscribe_email or email dispatch when the limiter blocks", async () => {
    vi.stubEnv("WAITLIST_RATE_LIMIT_MAX_REQUESTS", "1");
    const rpc = mockSupabase({ data: null, error: null });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const body = JSON.stringify({ email, confirmedAge13Plus: true });

    await POST(requestWith(body, "198.51.100.8"));
    rpc.mockClear();
    fetchMock.mockClear();

    const blocked = await POST(requestWith(body, "198.51.100.8"));

    expect(blocked.status).toBe(429);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(WAITLIST_RATE_LIMIT_RPC, expect.any(Object));
    expect(rpc).not.toHaveBeenCalledWith("subscribe_email", expect.anything());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("consumes rate-limit state through a single atomic RPC per request", async () => {
    const rpc = mockSupabase({ data: null, error: null });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await POST(
      requestWith(JSON.stringify({ email, confirmedAge13Plus: true }), "198.51.100.9")
    );

    const rateLimitCalls = rpc.mock.calls.filter(
      ([name]) => name === WAITLIST_RATE_LIMIT_RPC
    );

    expect(rateLimitCalls).toHaveLength(1);
    expect(rpc.mock.calls[0]?.[0]).toBe(WAITLIST_RATE_LIMIT_RPC);
    expect(rpc.mock.calls[1]?.[0]).toBe("subscribe_email");
  });

  it("returns a generic server error for unexpected subscription errors", async () => {
    getSupabaseAdmin.mockImplementationOnce(() => {
      throw new Error("Unexpected error");
    });

    const response = await POST(
      requestWith(JSON.stringify({ email, confirmedAge13Plus: true }), "198.51.100.7")
    );

    expect(response.status).toBe(500);
  });
});
