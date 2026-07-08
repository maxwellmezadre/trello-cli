import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AttachmentDownloadError,
  type DownloadFetch,
  type DownloadResponse,
  downloadToFile,
} from "../src/trello/attachments.js";

const workDir = mkdtempSync(join(tmpdir(), "trello-dl-"));
afterAll(() => rmSync(workDir, { recursive: true, force: true }));

const CONFIG = {
  apiKey: "KEY",
  token: "SECRET",
  allowedAttachmentHosts: ["trello.com", "trello-attachments.s3.amazonaws.com"],
  maxDownloadBytes: 1_000_000,
};

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      const chunk = chunks[index++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
  });
}

function makeResponse(opts: {
  status?: number;
  contentLength?: number;
  chunks?: Uint8Array[];
}): DownloadResponse {
  const headers: Record<string, string> = {};
  if (opts.contentLength !== undefined) {
    headers["content-length"] = String(opts.contentLength);
  }
  const status = opts.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    body: streamOf(opts.chunks ?? []),
  };
}

const UPLOAD_URL = "https://trello.com/1/cards/x/attachments/y/download/f.png";

describe("attachment auth", () => {
  test("uploaded url gets the exact OAuth header", async () => {
    let captured: Record<string, string> | undefined;
    const fetchMock: DownloadFetch = async (_url, init) => {
      captured = init?.headers;
      return makeResponse({ chunks: [bytes("hi")] });
    };

    await downloadToFile(
      { url: UPLOAD_URL, name: "f.png" },
      workDir,
      CONFIG,
      { fetch: fetchMock },
    );

    expect(captured?.Authorization).toBe(
      'OAuth oauth_consumer_key="KEY", oauth_token="SECRET"',
    );
  });

  test("allowed external host receives no credential", async () => {
    let captured: Record<string, string> | undefined;
    const fetchMock: DownloadFetch = async (_url, init) => {
      captured = init?.headers;
      return makeResponse({ chunks: [bytes("hi")] });
    };

    await downloadToFile(
      { url: "https://example.com/report.pdf", name: "report.pdf" },
      workDir,
      { ...CONFIG, allowedAttachmentHosts: ["example.com"] },
      { fetch: fetchMock },
    );

    expect(captured?.Authorization).toBeUndefined();
  });
});

describe("attachment SSRF guard", () => {
  test("host outside the allowlist is rejected before any fetch", async () => {
    let called = false;
    const fetchMock: DownloadFetch = async () => {
      called = true;
      return makeResponse({ chunks: [bytes("x")] });
    };

    await expect(
      downloadToFile(
        { url: "https://evil.example/x", name: "x" },
        workDir,
        CONFIG,
        { fetch: fetchMock },
      ),
    ).rejects.toBeInstanceOf(AttachmentDownloadError);
    expect(called).toBe(false);
  });
});

describe("attachment size cap", () => {
  test("rejects by Content-Length without writing a file", async () => {
    const fetchMock: DownloadFetch = async () =>
      makeResponse({ contentLength: 100, chunks: [bytes("x")] });

    await expect(
      downloadToFile(
        { url: UPLOAD_URL, name: "big.bin" },
        workDir,
        { ...CONFIG, maxDownloadBytes: 10 },
        { fetch: fetchMock },
      ),
    ).rejects.toBeInstanceOf(AttachmentDownloadError);
    expect(existsSync(join(workDir, "big.bin"))).toBe(false);
  });

  test("aborts a stream that exceeds the cap, leaving no partial file", async () => {
    const fetchMock: DownloadFetch = async () =>
      // Sem Content-Length: só o stream revela o excesso (3 + 6 = 9 > 5).
      makeResponse({ chunks: [bytes("123"), bytes("456789")] });

    await expect(
      downloadToFile(
        { url: UPLOAD_URL, name: "stream.bin" },
        workDir,
        { ...CONFIG, maxDownloadBytes: 5 },
        { fetch: fetchMock },
      ),
    ).rejects.toBeInstanceOf(AttachmentDownloadError);
    expect(existsSync(join(workDir, "stream.bin"))).toBe(false);
  });
});

describe("attachment download happy path", () => {
  test("streams the body to disk and reports byte count", async () => {
    const fetchMock: DownloadFetch = async () =>
      makeResponse({ chunks: [bytes("hello "), bytes("world")] });

    const result = await downloadToFile(
      { url: UPLOAD_URL, name: "h.txt" },
      workDir,
      CONFIG,
      { fetch: fetchMock },
    );

    expect(result.bytes).toBe(11);
    expect(readFileSync(join(workDir, "h.txt"), "utf8")).toBe("hello world");
  });

  test("sanitizes a traversal filename to its basename", async () => {
    const fetchMock: DownloadFetch = async () =>
      makeResponse({ chunks: [bytes("x")] });

    const result = await downloadToFile(
      { url: UPLOAD_URL, name: "../../etc/passwd" },
      workDir,
      CONFIG,
      { fetch: fetchMock },
    );

    expect(result.path).toBe(join(workDir, "passwd"));
  });
});
