import { Type } from "@sinclair/typebox";
import {
  downloadCardAttachment,
  enrichAttachment,
} from "../trello/attachments.js";
import { defineTool } from "./define.js";

export const getCardAttachments = defineTool({
  name: "get_card_attachments",
  description:
    "Lista os anexos de um card, marcando uploads vs. links e expondo a URI trello://.",
  readOnly: true,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
  }),
  run: async (args, ctx) => {
    const attachments = await ctx.trello.getCardAttachments(args.cardId);
    return attachments.map((attachment) =>
      enrichAttachment(args.cardId, attachment),
    );
  },
});

export const downloadAttachment = defineTool({
  name: "download_attachment",
  description:
    "Baixa um anexo de um card para o disco. Uploads usam auth OAuth automaticamente.",
  // Download não muda estado no Trello: disponível em read-only mode (F-20).
  readOnly: true,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    attachmentId: Type.String({ description: "ID do anexo" }),
    destDir: Type.Optional(
      Type.String({ description: "Diretório de destino (default: config)" }),
    ),
  }),
  run: (args, ctx) => downloadCardAttachment(ctx, args),
});
