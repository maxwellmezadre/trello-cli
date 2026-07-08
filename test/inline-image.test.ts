import { describe, expect, test } from "bun:test";
import type { Ctx } from "../src/context.js";
import {
  collectInlineImages,
  type DownloadFetch,
} from "../src/trello/attachments.js";
import type { Attachment } from "../src/trello/client.js";

const IMAGE: Attachment = {
  id: "IMG1",
  name: "pic.png",
  url: "https://trello.com/1/cards/x/attachments/IMG1/download/pic.png",
  bytes: 1024,
  date: "2026-07-01T00:00:00.000Z",
  mimeType: "image/png",
};

function ctxWith(
  overrides: Partial<Ctx["config"]>,
  attachments: Attachment[] = [IMAGE],
): Ctx {
  return {
    config: {
      apiKey: "KEY",
      token: "SECRET",
      allowedAttachmentHosts: ["trello.com"],
      maxDownloadBytes: 1_000_000,
      maxInlineImageBytes: 256 * 1024,
      downloadImages: true,
      ...overrides,
    },
    trello: { getCardAttachments: async () => attachments },
  } as unknown as Ctx;
}

// Um fetch que falha se chamado — prova que os cenários barrados nunca baixam.
const failingFetch: DownloadFetch = async () => {
  throw new Error("fetch should not be called when gated out");
};

describe("collectInlineImages gate", () => {
  test("returns nothing when downloadImages is off", async () => {
    const images = await collectInlineImages(
      ctxWith({ downloadImages: false }),
      "C1",
      { fetch: failingFetch },
    );
    expect(images).toHaveLength(0);
  });

  test("skips images larger than the inline cap", async () => {
    const big = { ...IMAGE, bytes: 512 * 1024 };
    const images = await collectInlineImages(
      ctxWith({ maxInlineImageBytes: 256 * 1024 }, [big]),
      "C1",
      { fetch: failingFetch },
    );
    expect(images).toHaveLength(0);
  });

  test("skips attachments whose host is not allowed", async () => {
    const images = await collectInlineImages(
      ctxWith({ allowedAttachmentHosts: ["example.com"] }),
      "C1",
      { fetch: failingFetch },
    );
    expect(images).toHaveLength(0);
  });

  test("skips non-image attachments", async () => {
    const pdf = { ...IMAGE, mimeType: "application/pdf", name: "doc.pdf" };
    const images = await collectInlineImages(ctxWith({}, [pdf]), "C1", {
      fetch: failingFetch,
    });
    expect(images).toHaveLength(0);
  });

  test("inlines a small allowed upload image", async () => {
    const fetchMock: DownloadFetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: (name) => (name === "content-type" ? "image/png" : null) },
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4]));
          controller.close();
        },
      }),
    });

    const images = await collectInlineImages(ctxWith({}), "C1", {
      fetch: fetchMock,
    });
    expect(images).toHaveLength(1);
    expect(images[0]?.mimeType).toBe("image/png");
    expect(images[0]?.base64).toBe(Buffer.from([1, 2, 3, 4]).toString("base64"));
  });
});
