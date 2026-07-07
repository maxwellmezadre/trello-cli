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

const position = Type.Union([Type.Number(), Type.String()], {
  description: 'Posição: número, "top" ou "bottom"',
});

export const createCard = defineTool({
  name: "create_card",
  description: "Cria um card em uma lista.",
  readOnly: false,
  input: Type.Object({
    listId: Type.String({ description: "ID da lista" }),
    name: Type.String({ description: "Nome do card" }),
    desc: Type.Optional(Type.String({ description: "Descrição" })),
    due: Type.Optional(Type.String({ description: "Vencimento (ISO 8601)" })),
    pos: Type.Optional(position),
  }),
  run: (args, ctx) =>
    ctx.trello.createCard({
      idList: args.listId,
      name: args.name,
      desc: args.desc,
      due: args.due,
      pos: args.pos,
    }),
});

export const updateCard = defineTool({
  name: "update_card",
  description: "Atualiza campos de um card (nome, descrição, vencimento).",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    name: Type.Optional(Type.String({ description: "Novo nome" })),
    desc: Type.Optional(Type.String({ description: "Nova descrição" })),
    due: Type.Optional(Type.String({ description: "Vencimento (ISO 8601)" })),
    dueComplete: Type.Optional(
      Type.Boolean({ description: "Marca o vencimento como concluído" }),
    ),
  }),
  run: (args, ctx) =>
    ctx.trello.updateCard(args.cardId, {
      name: args.name,
      desc: args.desc,
      due: args.due,
      dueComplete: args.dueComplete,
    }),
});

export const moveCard = defineTool({
  name: "move_card",
  description: "Move um card para outra lista.",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    listId: Type.String({ description: "ID da lista de destino" }),
    pos: Type.Optional(position),
  }),
  run: (args, ctx) => ctx.trello.moveCard(args.cardId, args.listId, args.pos),
});

export const archiveCard = defineTool({
  name: "archive_card",
  description: "Arquiva um card.",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
  }),
  run: (args, ctx) => ctx.trello.archiveCard(args.cardId),
});
