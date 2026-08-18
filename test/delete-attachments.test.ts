import { describe, expect, test } from "bun:test";
import type { Ctx } from "../src/context.js";
import { createContext } from "../src/context.js";
import type { FetchLike } from "../src/core/http.js";
import { runTool, ToolInputError } from "../src/tools/define.js";
import { allTools } from "../src/tools/registry.js";
import {
  deleteAllCardAttachments,
  deleteCardAttachment,
} from "../src/trello/attachments.js";

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
  downloadConcurrency: 2,
  cacheTtlMs: 0,
};

type Call = { method: string; path: string };

function attachment(id: string, name: string) {
  return { id, name, url: `https://trello.com/${id}`, bytes: 1, date: "", mimeType: null };
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : "OK",
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? "application/json" : null,
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/**
 * Fetch fake que registra method + pathname de cada chamada. `failing` são os
 * IDs cujo DELETE responde 404 — é assim que a corrida "alguém apagou no meio"
 * é simulada.
 */
function recordingFetch(
  calls: Call[],
  attachments: ReturnType<typeof attachment>[],
  failing: string[] = [],
): FetchLike {
  return async (url, init) => {
    const method = init?.method ?? "GET";
    const path = new URL(url).pathname;
    calls.push({ method, path });
    if (method === "DELETE") {
      const id = path.split("/").pop() ?? "";
      return failing.includes(id)
        ? jsonResponse(404, { message: "not found" })
        : jsonResponse(200, { _value: null });
    }
    return jsonResponse(200, attachments);
  };
}

function ctxWith(calls: Call[], atts: ReturnType<typeof attachment>[], failing?: string[]): Ctx {
  return createContext(CONFIG, { fetch: recordingFetch(calls, atts, failing) });
}

describe("delete_card_attachment", () => {
  test("confirms the attachment is on the card before deleting it", async () => {
    const calls: Call[] = [];
    const ctx = ctxWith(calls, [attachment("A1", "contrato.pdf")]);

    const result = await deleteCardAttachment(ctx, {
      cardId: "C1",
      attachmentId: "A1",
    });

    expect(result).toEqual({
      deleted: true,
      cardId: "C1",
      attachmentId: "A1",
      name: "contrato.pdf",
    });
    expect(calls).toEqual([
      { method: "GET", path: "/1/cards/C1/attachments" },
      { method: "DELETE", path: "/1/cards/C1/attachments/A1" },
    ]);
  });

  test("an id absent from the card errors WITHOUT issuing a DELETE", async () => {
    const calls: Call[] = [];
    const ctx = ctxWith(calls, [attachment("A1", "contrato.pdf")]);

    await expect(
      deleteCardAttachment(ctx, { cardId: "C1", attachmentId: "A9" }),
    ).rejects.toThrow("Attachment A9 not found on card C1");
    // O ponto do pré-check: nenhuma requisição destrutiva contra alvo não
    // verificado, qualquer que seja a resposta da Trello para id inexistente.
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  test("the error message never leaks the url with key/token", async () => {
    const calls: Call[] = [];
    const ctx = ctxWith(calls, [attachment("A1", "x.pdf")], ["A1"]);

    await expect(
      deleteCardAttachment(ctx, { cardId: "C1", attachmentId: "A1" }),
    ).rejects.toThrow(/no longer exists on card C1/);
    await expect(
      deleteCardAttachment(ctx, { cardId: "C1", attachmentId: "A1" }),
    ).rejects.not.toThrow(/SECRET|KEY|api\.trello\.com/);
  });
});

describe("delete_all_card_attachments", () => {
  test("one failure does not stop the others and lands in the report", async () => {
    const calls: Call[] = [];
    const ctx = ctxWith(
      calls,
      [attachment("A1", "a"), attachment("A2", "b"), attachment("A3", "c")],
      ["A2"],
    );

    const report = await deleteAllCardAttachments(ctx, { cardId: "C1" });

    expect(report.summary).toEqual({ total: 3, ok: 2, failed: 1 });
    expect(report.ok.map((entry) => entry.id).sort()).toEqual(["A1", "A3"]);
    expect(report.failed[0]?.id).toBe("A2");
    expect(report.failed[0]?.error).toContain("no longer exists");
    // Os três foram tentados: a falha do meio não abortou o lote.
    const deleted = calls
      .filter((call) => call.method === "DELETE")
      .map((call) => call.path.split("/").pop())
      .sort();
    expect(deleted).toEqual(["A1", "A2", "A3"]);
  });

  test("a card with no attachments reports zero without any DELETE", async () => {
    const calls: Call[] = [];
    const ctx = ctxWith(calls, []);

    const report = await deleteAllCardAttachments(ctx, { cardId: "C1" });

    expect(report.summary).toEqual({ total: 0, ok: 0, failed: 0 });
    expect(calls).toEqual([{ method: "GET", path: "/1/cards/C1/attachments" }]);
  });

  test("the confirm guard rejects a call without an explicit true", async () => {
    const tool = allTools.find(
      (candidate) => candidate.name === "delete_all_card_attachments",
    );
    if (!tool) throw new Error("tool not registered");
    const ctx = {} as Ctx;

    await expect(runTool(tool, { cardId: "C1" }, ctx)).rejects.toBeInstanceOf(
      ToolInputError,
    );
    await expect(
      runTool(tool, { cardId: "C1", confirm: false }, ctx),
    ).rejects.toBeInstanceOf(ToolInputError);
  });
});
