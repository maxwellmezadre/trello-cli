import { Type } from "@sinclair/typebox";
import { defineTool } from "./define.js";

export const getCardsInList = defineTool({
  name: "get_cards_in_list",
  description: "Lista os cards de uma lista.",
  readOnly: true,
  input: Type.Object({
    listId: Type.String({ description: "ID da lista" }),
  }),
  run: (args, ctx) => ctx.trello.getCardsInList(args.listId),
});

export const getCard = defineTool({
  name: "get_card",
  description: "Obtém os detalhes de um card por ID.",
  readOnly: true,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
  }),
  run: (args, ctx) => ctx.trello.getCard(args.cardId),
});

export const getComments = defineTool({
  name: "get_comments",
  description: "Lista os comentários de um card.",
  readOnly: true,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
  }),
  run: (args, ctx) => ctx.trello.getComments(args.cardId),
});
