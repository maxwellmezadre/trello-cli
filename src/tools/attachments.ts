import { Type } from "@sinclair/typebox";
import { enrichAttachment } from "../trello/attachments.js";
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
