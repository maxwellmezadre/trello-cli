import { Type } from "@sinclair/typebox";
import { defineTool } from "./define.js";

export const getBoardLabels = defineTool({
  name: "get_board_labels",
  description: "Lista as labels de um board.",
  readOnly: true,
  input: Type.Object({
    boardId: Type.String({ description: "ID do board" }),
  }),
  run: async (args, ctx) =>
    ctx.trello.getBoardLabels(await ctx.trello.resolveBoard(args.boardId)),
});

export const createLabel = defineTool({
  name: "create_label",
  description: "Cria uma label em um board.",
  readOnly: false,
  input: Type.Object({
    boardId: Type.String({ description: "ID do board" }),
    name: Type.String({ description: "Nome da label" }),
    color: Type.Optional(
      Type.String({ description: "Cor (ex. green, red, blue) ou vazio" }),
    ),
  }),
  run: async (args, ctx) =>
    ctx.trello.createLabel({
      idBoard: await ctx.trello.resolveBoard(args.boardId),
      name: args.name,
      color: args.color,
    }),
});

export const addLabelToCard = defineTool({
  name: "add_label_to_card",
  description: "Atribui uma label a um card.",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    labelId: Type.String({ description: "ID da label" }),
  }),
  run: (args, ctx) => ctx.trello.addLabelToCard(args.cardId, args.labelId),
});
