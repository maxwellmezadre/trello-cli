import { Type } from "@sinclair/typebox";
import {
  deleteAllCardAttachments,
  deleteCardAttachment,
  downloadAllCardAttachments,
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

export const downloadAllAttachments = defineTool({
  name: "download_all_card_attachments",
  description:
    "Baixa todos os anexos de um card com concorrência limitada e escreve _manifest.json.",
  readOnly: true,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    destDir: Type.Optional(
      Type.String({ description: "Diretório de destino (default: config)" }),
    ),
    concurrency: Type.Optional(
      Type.Number({ description: "Downloads simultâneos (default: config)" }),
    ),
  }),
  run: (args, ctx) => downloadAllCardAttachments(ctx, args),
});

export const attachUrlToCard = defineTool({
  name: "attach_url_to_card",
  description: "Anexa uma URL a um card.",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    url: Type.String({ description: "URL a anexar" }),
  }),
  run: (args, ctx) => ctx.trello.attachUrlToCard(args.cardId, args.url),
});

export const attachFileToCard = defineTool({
  name: "attach_file_to_card",
  description: "Faz upload de um arquivo local como anexo de um card.",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    filePath: Type.String({ description: "Caminho do arquivo local" }),
    name: Type.Optional(
      Type.String({ description: "Nome do anexo (default: basename)" }),
    ),
  }),
  run: (args, ctx) =>
    ctx.trello.attachFileToCard(args.cardId, args.filePath, args.name),
});

export const deleteAttachment = defineTool({
  name: "delete_card_attachment",
  description: "Remove um anexo de um card. Irreversível — o anexo é apagado.",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    attachmentId: Type.String({ description: "ID do anexo" }),
  }),
  run: (args, ctx) => deleteCardAttachment(ctx, args),
});

export const deleteAllAttachments = defineTool({
  name: "delete_all_card_attachments",
  description:
    "Remove TODOS os anexos de um card. Irreversível — exige confirm: true.",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    // Guarda contra remoção acidental em massa por um agente: o schema exige o
    // literal `true`, então a recusa vem do próprio runTool (ToolInputError) e
    // o requisito aparece no inputSchema anunciado pelo MCP.
    confirm: Type.Literal(true, {
      description: "Precisa ser true — confirma a remoção de todos os anexos",
    }),
    concurrency: Type.Optional(
      Type.Number({ description: "Deleções simultâneas (default: config)" }),
    ),
  }),
  run: (args, ctx) =>
    deleteAllCardAttachments(ctx, {
      cardId: args.cardId,
      concurrency: args.concurrency,
    }),
});
