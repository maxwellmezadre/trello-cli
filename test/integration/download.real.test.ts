import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../src/config.js";
import { createContext } from "../../src/context.js";
import {
  downloadCardAttachment,
  isUploadedAttachment,
} from "../../src/trello/attachments.js";

// Teste de integração REAL contra a Trello — mata o risco nº 1 do PRD (o Trello
// mudar a auth de anexos e o download de uploads quebrar em silêncio).
//
// Gated: só roda com TRELLO_API_KEY / TRELLO_TOKEN / TRELLO_TEST_CARD_ID (um
// card com um anexo enviado por upload). Sem elas, é pulado de forma visível.
// Setup em CONTRIBUTING.md.
const hasCreds = Boolean(
  process.env.TRELLO_API_KEY &&
    process.env.TRELLO_TOKEN &&
    process.env.TRELLO_TEST_CARD_ID,
);

const workDir = mkdtempSync(join(tmpdir(), "trello-integ-"));
afterAll(() => rmSync(workDir, { recursive: true, force: true }));

const gated = hasCreds ? test : test.skip;

gated(
  "downloads a real uploaded attachment with OAuth header auth",
  async () => {
    const ctx = createContext(loadConfig());
    const cardId = process.env.TRELLO_TEST_CARD_ID as string;

    const attachments = await ctx.trello.getCardAttachments(cardId);
    const upload = attachments.find((attachment) =>
      isUploadedAttachment(attachment.url),
    );
    expect(upload, "test card must have an uploaded attachment").toBeDefined();

    const result = await downloadCardAttachment(
      ctx,
      { cardId, attachmentId: (upload as { id: string }).id, destDir: workDir },
      undefined,
    );

    // Sem o header OAuth, viria HTML de login/401 em vez dos bytes reais.
    expect(result.isUpload).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
  },
);
