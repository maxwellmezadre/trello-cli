import { Type } from "@sinclair/typebox";
import { defineTool } from "./define.js";

export const getBoardMembers = defineTool({
  name: "get_board_members",
  description: "Lista os membros de um board.",
  readOnly: true,
  input: Type.Object({
    boardId: Type.String({ description: "ID do board" }),
  }),
  run: async (args, ctx) =>
    ctx.trello.getBoardMembers(await ctx.trello.resolveBoard(args.boardId)),
});

export const assignMemberToCard = defineTool({
  name: "assign_member_to_card",
  description: "Atribui um membro a um card.",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    memberId: Type.String({ description: "ID do membro" }),
  }),
  run: (args, ctx) => ctx.trello.assignMemberToCard(args.cardId, args.memberId),
});
