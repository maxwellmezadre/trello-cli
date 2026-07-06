import { describe, expect, test } from "bun:test";
import { ConfigError, loadConfig } from "../src/config.js";

const REQUIRED = { TRELLO_API_KEY: "key123", TRELLO_TOKEN: "tok456" };

describe("loadConfig fail-fast", () => {
  test("missing api key throws an actionable error", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/TRELLO_API_KEY is required/);
  });

  test("missing token is reported even when key is present", () => {
    expect(() => loadConfig({ TRELLO_API_KEY: "key123" })).toThrow(
      /TRELLO_TOKEN is required/,
    );
  });

  test("aggregates every problem in one error", () => {
    try {
      loadConfig({});
      throw new Error("expected loadConfig to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).problems).toHaveLength(2);
    }
  });
});

describe("loadConfig defaults", () => {
  test("applies documented defaults with only required vars", () => {
    const config = loadConfig({ ...REQUIRED });
    expect(config).toMatchObject({
      apiKey: "key123",
      token: "tok456",
      readOnly: false,
      compact: false,
      downloadDir: "./trello-downloads",
      downloadImages: false,
      maxInlineImageBytes: 262_144,
      maxDownloadBytes: 52_428_800,
      downloadConcurrency: 4,
      cacheTtlMs: 30_000,
    });
    expect(config.allowedAttachmentHosts).toEqual([
      "trello.com",
      "api.trello.com",
      "trello-attachments.s3.amazonaws.com",
    ]);
    expect(config.boardId).toBeUndefined();
    expect(config.logFile).toBeUndefined();
  });
});

describe("loadConfig parsing", () => {
  test("parses booleans and rejects unknown boolean values", () => {
    expect(loadConfig({ ...REQUIRED, TRELLO_READ_ONLY: "1" }).readOnly).toBe(
      true,
    );
    expect(loadConfig({ ...REQUIRED, TRELLO_READ_ONLY: "false" }).readOnly).toBe(
      false,
    );
    expect(() =>
      loadConfig({ ...REQUIRED, TRELLO_READ_ONLY: "maybe" }),
    ).toThrow(/TRELLO_READ_ONLY must be a boolean/);
  });

  test("rejects non-integer and out-of-range numbers", () => {
    expect(() =>
      loadConfig({ ...REQUIRED, TRELLO_MAX_DOWNLOAD_BYTES: "lots" }),
    ).toThrow(/TRELLO_MAX_DOWNLOAD_BYTES must be an integer/);
    expect(() =>
      loadConfig({ ...REQUIRED, TRELLO_DOWNLOAD_CONCURRENCY: "0" }),
    ).toThrow(/TRELLO_DOWNLOAD_CONCURRENCY must be an integer >= 1/);
  });

  test("normalizes the attachment host allowlist", () => {
    const config = loadConfig({
      ...REQUIRED,
      TRELLO_ALLOWED_ATTACHMENT_HOSTS: "Foo.com, BAR.com ,,baz.com",
    });
    expect(config.allowedAttachmentHosts).toEqual([
      "foo.com",
      "bar.com",
      "baz.com",
    ]);
  });
});
