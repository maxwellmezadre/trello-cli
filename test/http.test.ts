import { describe, expect, test } from "bun:test";
import {
  createTrelloHttp,
  type FetchLike,
  type FetchResponse,
  RateLimiter,
  TrelloApiError,
} from "../src/core/http.js";

const AUTH = { apiKey: "KEY", token: "SUPERSECRET" };

function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += Math.max(0, ms);
    },
  };
}

function makeResponse(opts: {
  status: number;
  headers?: Record<string, string>;
  json?: unknown;
}): FetchResponse {
  const headers = opts.headers ?? { "content-type": "application/json" };
  return {
    ok: opts.status >= 200 && opts.status < 300,
    status: opts.status,
    statusText: "",
    headers: {
      get: (name) => headers[name.toLowerCase()] ?? null,
    },
    json: async () => opts.json ?? {},
    text: async () => "",
  };
}

describe("RateLimiter", () => {
  test("never exceeds capacity within the window", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({
      capacity: 90,
      windowMs: 10_000,
      now: clock.now,
      sleep: clock.sleep,
    });

    const stamps: number[] = [];
    for (let i = 0; i < 100; i++) {
      await limiter.take();
      stamps.push(clock.now());
    }

    const inFirstWindow = stamps.filter((s) => s < 10_000).length;
    expect(inFirstWindow).toBeLessThanOrEqual(90);
    // As primeiras 90 passam sem esperar (burst permitido).
    expect(stamps.slice(0, 90).every((s) => s === 0)).toBe(true);
  });
});

describe("createTrelloHttp retry/backoff", () => {
  test("retries a 429 only after Retry-After seconds", async () => {
    const clock = fakeClock();
    let calls = 0;
    const fetchMock: FetchLike = async () => {
      calls++;
      if (calls === 1) {
        return makeResponse({ status: 429, headers: { "retry-after": "2" } });
      }
      return makeResponse({ status: 200, json: { ok: true } });
    };

    const http = createTrelloHttp(AUTH, {
      fetch: fetchMock,
      sleep: clock.sleep,
      random: () => 0,
      rateLimiter: new RateLimiter({
        capacity: 90,
        windowMs: 10_000,
        now: clock.now,
        sleep: clock.sleep,
      }),
    });

    const before = clock.now();
    const body = await http.request("/1/members/me/boards");

    expect(body).toEqual({ ok: true });
    expect(calls).toBe(2);
    expect(clock.now() - before).toBe(2000);
  });

  test("gives up after max attempts on repeated 429", async () => {
    const clock = fakeClock();
    let calls = 0;
    const fetchMock: FetchLike = async () => {
      calls++;
      return makeResponse({ status: 429, headers: { "retry-after": "1" } });
    };

    const http = createTrelloHttp(AUTH, {
      fetch: fetchMock,
      sleep: clock.sleep,
      random: () => 0,
    });

    await expect(http.request("/1/x")).rejects.toBeInstanceOf(TrelloApiError);
    expect(calls).toBe(3);
  });
});

describe("createTrelloHttp errors", () => {
  test("throws a typed error that never contains the token", async () => {
    const fetchMock: FetchLike = async () =>
      makeResponse({ status: 401, headers: { "content-type": "text/html" } });

    const http = createTrelloHttp(AUTH, {
      fetch: fetchMock,
      sleep: async () => {},
      random: () => 0,
    });

    try {
      await http.request("/1/members/me/boards");
      throw new Error("expected request to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TrelloApiError);
      expect((error as TrelloApiError).status).toBe(401);
      expect((error as Error).message).not.toContain("SUPERSECRET");
    }
  });

  test("does not retry non-retryable statuses", async () => {
    let calls = 0;
    const fetchMock: FetchLike = async () => {
      calls++;
      return makeResponse({ status: 404 });
    };

    const http = createTrelloHttp(AUTH, {
      fetch: fetchMock,
      sleep: async () => {},
      random: () => 0,
    });

    await expect(http.request("/1/cards/nope")).rejects.toBeInstanceOf(
      TrelloApiError,
    );
    expect(calls).toBe(1);
  });
});
