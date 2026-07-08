import { describe, expect, test } from "bun:test";
import { createContext } from "../src/context.js";
import { TtlLruCache } from "../src/core/cache.js";
import type { FetchLike } from "../src/core/http.js";

describe("TtlLruCache", () => {
  test("returns a value within its ttl and misses after expiry", () => {
    let clock = 0;
    const cache = new TtlLruCache<string>(1000, 10, () => clock);
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
    clock = 1000; // atinge o expiry
    expect(cache.get("k")).toBeUndefined();
  });

  test("evicts the least-recently-used entry beyond capacity", () => {
    const cache = new TtlLruCache<number>(10_000, 2, () => 0);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // 'a' vira o mais recente; 'b' é o LRU
    cache.set("c", 3); // excede capacidade → remove 'b'
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });

  test("ttl of 0 disables the cache", () => {
    const cache = new TtlLruCache<string>(0, 10, () => 0);
    cache.set("k", "v");
    expect(cache.get("k")).toBeUndefined();
  });
});

const CONFIG = {
  apiKey: "KEY",
  token: "SECRET",
  readOnly: false,
  compact: false,
  downloadDir: "x",
  downloadImages: false,
  maxInlineImageBytes: 1,
  maxDownloadBytes: 1,
  allowedAttachmentHosts: [],
  downloadConcurrency: 1,
  cacheTtlMs: 30_000,
};

function jsonFetch(counter: { calls: number }): FetchLike {
  return async () => {
    counter.calls++;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (name) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => [],
      text: async () => "",
    };
  };
}

describe("client cache integration", () => {
  test("two getLists within the ttl issue a single fetch", async () => {
    const counter = { calls: 0 };
    const ctx = createContext(CONFIG, { fetch: jsonFetch(counter) });
    await ctx.trello.getLists("B1");
    await ctx.trello.getLists("B1");
    expect(counter.calls).toBe(1);
  });

  test("createList invalidates the board metadata cache", async () => {
    const counter = { calls: 0 };
    const ctx = createContext(CONFIG, { fetch: jsonFetch(counter) });
    await ctx.trello.getLists("B1"); // fetch #1
    await ctx.trello.createList({ idBoard: "B1", name: "New" }); // POST #2 + invalida
    await ctx.trello.getLists("B1"); // cache invalidado → fetch #3
    expect(counter.calls).toBe(3);
  });
});
