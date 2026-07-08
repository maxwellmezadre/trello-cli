import { Type } from "@sinclair/typebox";
import { defineTool } from "./define.js";

export const getCustomFields = defineTool({
  name: "get_custom_fields",
  description: "Lista as definições de custom fields de um board.",
  readOnly: true,
  input: Type.Object({
    boardId: Type.String({ description: "ID do board" }),
  }),
  run: (args, ctx) => ctx.trello.getCustomFields(args.boardId),
});

export const getCardCustomFields = defineTool({
  name: "get_card_custom_fields",
  description: "Lê os valores de custom fields de um card.",
  readOnly: true,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
  }),
  run: (args, ctx) => ctx.trello.getCardCustomFields(args.cardId),
});

export const setCardCustomField = defineTool({
  name: "set_card_custom_field",
  description: "Define o valor de um custom field em um card.",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    customFieldId: Type.String({ description: "ID do custom field" }),
    value: Type.String({
      description: "Valor (para list, o id da opção)",
    }),
    type: Type.Optional(
      Type.Union(
        [
          Type.Literal("text"),
          Type.Literal("number"),
          Type.Literal("checked"),
          Type.Literal("date"),
          Type.Literal("list"),
        ],
        { description: "Tipo do campo (default: text)" },
      ),
    ),
  }),
  run: (args, ctx) =>
    ctx.trello.setCardCustomField(
      args.cardId,
      args.customFieldId,
      args.value,
      args.type,
    ),
});
