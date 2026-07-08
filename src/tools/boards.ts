import { Type } from "@sinclair/typebox";
import { isCompact, shapeBoard, shapeList } from "../trello/shape.js";
import { defineTool } from "./define.js";

const compactField = Type.Optional(
  Type.Boolean({ description: "Retorna campos mínimos (default: env)" }),
);

export const listBoards = defineTool({
  name: "list_boards",
  description: "Lista os boards do usuário autenticado.",
  readOnly: true,
  input: Type.Object({ compact: compactField }),
  run: async (args, ctx) => {
    const boards = await ctx.trello.listBoards();
    const compact = isCompact(args.compact, ctx.config);
    return boards.map((board) => shapeBoard(board, compact));
  },
});

export const getBoard = defineTool({
  name: "get_board",
  description: "Obtém um board por ID, opcionalmente com suas listas abertas.",
  readOnly: true,
  input: Type.Object({
    boardId: Type.String({ description: "ID do board" }),
    withLists: Type.Optional(
      Type.Boolean({ description: "Incluir as listas abertas do board" }),
    ),
    compact: compactField,
  }),
  run: async (args, ctx) => {
    const boardId = await ctx.trello.resolveBoard(args.boardId);
    const board = await ctx.trello.getBoard(boardId, {
      withLists: args.withLists,
    });
    return shapeBoard(board, isCompact(args.compact, ctx.config));
  },
});

export const getLists = defineTool({
  name: "get_lists",
  description: "Lista as listas de um board.",
  readOnly: true,
  input: Type.Object({
    boardId: Type.String({ description: "ID do board" }),
    compact: compactField,
  }),
  run: async (args, ctx) => {
    const boardId = await ctx.trello.resolveBoard(args.boardId);
    const lists = await ctx.trello.getLists(boardId);
    const compact = isCompact(args.compact, ctx.config);
    return lists.map((list) => shapeList(list, compact));
  },
});

export const createList = defineTool({
  name: "create_list",
  description: "Cria uma lista em um board.",
  readOnly: false,
  input: Type.Object({
    boardId: Type.String({ description: "ID do board" }),
    name: Type.String({ description: "Nome da lista" }),
  }),
  run: async (args, ctx) => {
    const boardId = await ctx.trello.resolveBoard(args.boardId);
    return ctx.trello.createList({ idBoard: boardId, name: args.name });
  },
});
