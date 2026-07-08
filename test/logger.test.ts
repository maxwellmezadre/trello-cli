import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogger, redactSecrets } from "../src/core/logger.js";

const workDir = mkdtempSync(join(tmpdir(), "trello-log-"));
afterAll(() => rmSync(workDir, { recursive: true, force: true }));

describe("redactSecrets", () => {
  test("replaces every secret occurrence with ***", () => {
    const message = "auth failed for token=SECRET123 key=KEYABC and SECRET123";
    expect(redactSecrets(message, ["SECRET123", "KEYABC"])).toBe(
      "auth failed for token=*** key=*** and ***",
    );
  });

  test("ignores empty secrets", () => {
    expect(redactSecrets("plain message", ["", undefined as never])).toBe(
      "plain message",
    );
  });
});

describe("createLogger file output", () => {
  test("never writes the token to the log file", () => {
    const logFile = join(workDir, "app.log");
    const log = createLogger({ logFile, secrets: ["TOKENXYZ", "APIKEY9"] });

    log.info("calling api with token=TOKENXYZ key=APIKEY9");
    log.error("retry failed, token still TOKENXYZ");

    const contents = readFileSync(logFile, "utf8");
    expect(contents).not.toContain("TOKENXYZ");
    expect(contents).not.toContain("APIKEY9");
    expect(contents).toContain("***");
  });
});
