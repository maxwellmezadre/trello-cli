import { Type } from "@sinclair/typebox";
import { isCompact, shapeCard } from "../trello/shape.js";
import { defineTool } from "./define.js";

const compactField = Type.Optional(
  Type.Boolean({ description: "Retorna campos mínimos (default: env)" }),
);

export const getCardsInList = defineTool({
  name: "get_cards_in_list",
  description: "Lista os cards de uma lista.",
  readOnly: true,
  input: Type.Object({
    listId: Type.String({ description: "ID da lista" }),
    compact: compactField,
  }),
  run: async (args, ctx) => {
    const cards = await ctx.trello.getCardsInList(args.listId);
    const compact = isCompact(args.compact, ctx.config);
    return cards.map((card) => shapeCard(card, compact));
  },
});

export const getCard = defineTool({
  name: "get_card",
  description: "Obtém os detalhes de um card por ID.",
  readOnly: true,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    compact: compactField,
  }),
  run: async (args, ctx) => {
    const card = await ctx.trello.getCard(args.cardId);
    return shapeCard(card, isCompact(args.compact, ctx.config));
  },
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

export const addComment = defineTool({
  name: "add_comment",
  description: "Adiciona um comentário a um card.",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    text: Type.String({ description: "Texto do comentário" }),
  }),
  run: (args, ctx) => ctx.trello.addComment(args.cardId, args.text),
});
