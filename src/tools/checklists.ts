import { Type } from "@sinclair/typebox";
import { defineTool } from "./define.js";

export const getChecklists = defineTool({
  name: "get_checklists",
  description: "Lista os checklists de um card, com seus itens.",
  readOnly: true,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
  }),
  run: (args, ctx) => ctx.trello.getChecklists(args.cardId),
});
