import { Type } from "@sinclair/typebox";
import { defineTool } from "./define.js";

export const search = defineTool({
  name: "search",
  description: "Busca universal em boards, cards e organizações.",
  readOnly: true,
  input: Type.Object({
    query: Type.String({ description: "Termo de busca (substring, partial)" }),
    modelTypes: Type.Optional(
      Type.String({ description: 'Tipos, ex. "boards,cards,organizations"' }),
    ),
    boardsLimit: Type.Optional(
      Type.Number({ description: "Limite de boards no resultado" }),
    ),
    cardsLimit: Type.Optional(
      Type.Number({ description: "Limite de cards no resultado" }),
    ),
  }),
  run: (args, ctx) => ctx.trello.search(args),
});
