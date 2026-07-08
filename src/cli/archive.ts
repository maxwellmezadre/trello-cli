import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Ctx } from "../context.js";
import {
  type DownloadFetch,
  downloadAllCardAttachments,
} from "../trello/attachments.js";

// Exporta um board inteiro para o disco (F-17/F-25): board.json com
// cards+comments+checklists e, por card, os anexos baixados (pipeline da
// etapa 012 — concorrência limitada + tolerância a falhas). Um manifest global
// agrega todas as falhas de anexo.
//
// ponytail: export é all-or-rerun; adicionar retomada incremental se boards
// grandes começarem a doer.

export type ArchiveSummary = {
  outDir: string;
  cards: number;
  failedAttachments: number;
};

export async function archiveBoard(
  ctx: Ctx,
  boardId: string,
  outDir: string,
  deps?: { fetch?: DownloadFetch },
): Promise<ArchiveSummary> {
  const board = await ctx.trello.getBoard(boardId);
  const lists = await ctx.trello.getLists(boardId);
  const cards = await ctx.trello.getBoardCards(boardId);
  await mkdir(outDir, { recursive: true });

  const cardExports = [];
  const globalFailed: Array<{ cardId: string; id: string; name: string; error: string }> =
    [];

  // Cards em série; os downloads DENTRO de cada card são concorrentes e
  // rate-limited. Uma falha de anexo não aborta o export (NFR-6).
  for (const card of cards) {
    const [comments, checklists] = await Promise.all([
      ctx.trello.getComments(card.id),
      ctx.trello.getChecklists(card.id),
    ]);
    const cardDir = join(outDir, "cards", card.id);
    const attachments = await downloadAllCardAttachments(
      ctx,
      { cardId: card.id, destDir: cardDir },
      deps,
    );
    for (const failure of attachments.failed) {
      globalFailed.push({ cardId: card.id, ...failure });
    }
    cardExports.push({ card, comments, checklists, attachments });
  }

  await writeFile(
    join(outDir, "board.json"),
    JSON.stringify({ board, lists, cards: cardExports }, null, 2),
  );
  await writeFile(
    join(outDir, "_manifest.json"),
    JSON.stringify(
      {
        failed: globalFailed,
        summary: {
          cards: cards.length,
          failedAttachments: globalFailed.length,
        },
      },
      null,
      2,
    ),
  );

  return {
    outDir,
    cards: cards.length,
    failedAttachments: globalFailed.length,
  };
}
