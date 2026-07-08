import { describe, expect, test } from "bun:test";
import type { Attachment } from "../src/trello/client.js";
import {
  enrichAttachment,
  isUploadedAttachment,
} from "../src/trello/attachments.js";

describe("isUploadedAttachment", () => {
  test("classifies Trello-hosted uploads as uploads", () => {
    expect(
      isUploadedAttachment(
        "https://trello.com/1/cards/abc/attachments/def/download/file.pdf",
      ),
    ).toBe(true);
    expect(
      isUploadedAttachment(
        "https://trello-attachments.s3.amazonaws.com/5f/abc/file.png",
      ),
    ).toBe(true);
  });

  test("classifies external links as not uploads", () => {
    expect(isUploadedAttachment("https://example.com/report.pdf")).toBe(false);
    expect(isUploadedAttachment("https://drive.google.com/file/d/xyz")).toBe(
      false,
    );
  });

  test("treats an unparseable url as not an upload", () => {
    expect(isUploadedAttachment("not a url")).toBe(false);
  });
});

describe("enrichAttachment", () => {
  test("adds isUpload and a trello:// resource uri", () => {
    const attachment: Attachment = {
      id: "ATT1",
      name: "file.png",
      url: "https://trello-attachments.s3.amazonaws.com/5f/abc/file.png",
      bytes: 1024,
      date: "2026-07-01T00:00:00.000Z",
      mimeType: "image/png",
    };

    const enriched = enrichAttachment("CARD1", attachment);
    expect(enriched.isUpload).toBe(true);
    expect(enriched.uri).toBe("trello://cards/CARD1/attachments/ATT1");
  });
});
