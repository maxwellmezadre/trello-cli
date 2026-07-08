import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Ctx } from "../src/context.js";
import {
  type DownloadFetch,
  type DownloadManifest,
  type DownloadResponse,
  downloadAllCardAttachments,
} from "../src/trello/attachments.js";
import type { Attachment } from "../src/trello/client.js";

const workDir = mkdtempSync(join(tmpdir(), "trello-bulk-"));
afterAll(() => rmSync(workDir, { recursive: true, force: true }));

function response(status: number, chunk = "x"): DownloadResponse {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    body: status >= 200 && status < 300 ? body : null,
  };
}

function fakeCtx(attachments: Attachment[], concurrency: number): Ctx {
  return {
    config: {
      apiKey: "KEY",
      token: "SECRET",
      allowedAttachmentHosts: ["trello.com"],
      maxDownloadBytes: 1_000_000,
      downloadConcurrency: concurrency,
      downloadDir: workDir,
    },
    trello: { getCardAttachments: async () => attachments },
  } as unknown as Ctx;
}

function attachmentsWithOneBad(count: number, badIndex: number): Attachment[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `A${index}`,
    name: `file-${index}.bin`,
    url:
      index === badIndex
        ? "https://trello.com/bad"
        : `https://trello.com/good-${index}`,
    bytes: 1,
    date: "2026-07-01T00:00:00.000Z",
    mimeType: null,
  }));
}

describe("downloadAllCardAttachments", () => {
  test("tolerates one failure and records it in the manifest", async () => {
    const destDir = join(workDir, "card-tolerate");
    const attachments = attachmentsWithOneBad(5, 2);
    const fetchMock: DownloadFetch = async (url) =>
      url.includes("/bad") ? response(404) : response(200);

    const manifest = await downloadAllCardAttachments(
      fakeCtx(attachments, 4),
      { cardId: "C1", destDir },
      { fetch: fetchMock },
    );

    expect(manifest.summary).toEqual({ total: 5, ok: 4, failed: 1 });
    expect(manifest.failed[0]?.error).toContain("404");

    // 4 arquivos gravados, o que falhou não deixou arquivo.
    for (const entry of manifest.ok) expect(existsSync(entry.path)).toBe(true);
    expect(existsSync(join(destDir, "file-2.bin"))).toBe(false);

    // _manifest.json fiel no disco.
    const written = JSON.parse(
      readFileSync(join(destDir, "_manifest.json"), "utf8"),
    ) as DownloadManifest;
    expect(written.summary.ok).toBe(4);
    expect(written.failed).toHaveLength(1);
  });

  test("never exceeds the concurrency limit", async () => {
    const destDir = join(workDir, "card-concurrency");
    const attachments = attachmentsWithOneBad(8, -1);
    let active = 0;
    let maxActive = 0;
    const fetchMock: DownloadFetch = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return response(200);
    };

    await downloadAllCardAttachments(
      fakeCtx(attachments, 3),
      { cardId: "C1", destDir, concurrency: 3 },
      { fetch: fetchMock },
    );

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1); // realmente paralelizou
  });
});
