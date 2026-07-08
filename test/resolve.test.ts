import { describe, expect, test } from "bun:test";
import { createContext } from "../src/context.js";
import type { FetchLike } from "../src/core/http.js";
import { isTrelloId, pickByName } from "../src/trello/resolve.js";

describe("isTrelloId", () => {
  test("recognizes 24-char hex ids and rejects names", () => {
    expect(isTrelloId("5f2a1b3c4d5e6f7a8b9c0d1e")).toBe(true);
    expect(isTrelloId("Meu Board")).toBe(false);
    expect(isTrelloId("short")).toBe(false);
  });
});

describe("pickByName", () => {
  const boards = [
    { id: "aaa", name: "Alpha" },
    { id: "bbb", name: "Beta" },
    { id: "ccc", name: "Beta" },
  ];

  test("resolves a unique case-insensitive match", () => {
    expect(pickByName(boards, "alpha", "Board")).toBe("aaa");
  });

  test("throws for a name that does not exist", () => {
    expect(() => pickByName(boards, "Gamma", "Board")).toThrow(
      /não encontrado/,
    );
  });

  test("throws listing candidates for an ambiguous name", () => {
    expect(() => pickByName(boards, "Beta", "Board")).toThrow(
      /ambíguo.*bbb.*ccc/s,
    );
  });
});

const CONFIG = {
  apiKey: "K",
  token: "T",
  readOnly: false,
  compact: false,
  downloadDir: "x",
  downloadImages: false,
  maxInlineImageBytes: 1,
  maxDownloadBytes: 1,
  allowedAttachmentHosts: [],
  downloadConcurrency: 1,
  cacheTtlMs: 0,
};

function boardsFetch(): FetchLike {
  return async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {
      get: (name) =>
        name.toLowerCase() === "content-type" ? "application/json" : null,
    },
    json: async () => [
      { id: "aaa", name: "Meu Board", closed: false, url: "" },
    ],
    text: async () => "",
  });
}

describe("client.resolveBoard integration", () => {
  test("resolves a board name to its id via listBoards", async () => {
    const ctx = createContext(CONFIG, { fetch: boardsFetch() });
    expect(await ctx.trello.resolveBoard("Meu Board")).toBe("aaa");
  });

  test("passes an id through without any fetch", async () => {
    let called = false;
    const fetchThatFails: FetchLike = async () => {
      called = true;
      throw new Error("should not fetch for an id");
    };
    const ctx = createContext(CONFIG, { fetch: fetchThatFails });
    expect(await ctx.trello.resolveBoard("5f2a1b3c4d5e6f7a8b9c0d1e")).toBe(
      "5f2a1b3c4d5e6f7a8b9c0d1e",
    );
    expect(called).toBe(false);
  });
});
