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

export const addChecklist = defineTool({
  name: "add_checklist",
  description: "Adiciona um checklist a um card.",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    name: Type.String({ description: "Nome do checklist" }),
  }),
  run: (args, ctx) => ctx.trello.addChecklist(args.cardId, args.name),
});

export const addChecklistItem = defineTool({
  name: "add_checklist_item",
  description: "Adiciona um item a um checklist.",
  readOnly: false,
  input: Type.Object({
    checklistId: Type.String({ description: "ID do checklist" }),
    name: Type.String({ description: "Nome do item" }),
    checked: Type.Optional(
      Type.Boolean({ description: "Cria o item já marcado" }),
    ),
  }),
  run: (args, ctx) =>
    ctx.trello.addChecklistItem(args.checklistId, args.name, args.checked),
});

export const setChecklistItemState = defineTool({
  name: "set_checklist_item_state",
  description: "Marca ou desmarca um item de checklist.",
  readOnly: false,
  input: Type.Object({
    cardId: Type.String({ description: "ID do card" }),
    checkItemId: Type.String({ description: "ID do item de checklist" }),
    state: Type.Union([Type.Literal("complete"), Type.Literal("incomplete")], {
      description: "Novo estado do item",
    }),
  }),
  run: (args, ctx) =>
    ctx.trello.setChecklistItemState(args.cardId, args.checkItemId, args.state),
});
