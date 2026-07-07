import { Type } from "@sinclair/typebox";
import { defineTool } from "./define.js";

export const listBoards = defineTool({
  name: "list_boards",
  description: "Lista os boards do usuário autenticado.",
  readOnly: true,
  input: Type.Object({}),
  run: (_args, ctx) => ctx.trello.listBoards(),
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
  }),
  run: (args, ctx) =>
    ctx.trello.getBoard(args.boardId, { withLists: args.withLists }),
});

export const getLists = defineTool({
  name: "get_lists",
  description: "Lista as listas de um board.",
  readOnly: true,
  input: Type.Object({
    boardId: Type.String({ description: "ID do board" }),
  }),
  run: (args, ctx) => ctx.trello.getLists(args.boardId),
});
