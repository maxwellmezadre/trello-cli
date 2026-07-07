import type { Config } from "../config.js";
import { createList, getBoard, getLists, listBoards } from "./boards.js";
import {
  addComment,
  archiveCard,
  createCard,
  getCard,
  getCardsInList,
  getComments,
  moveCard,
  updateCard,
} from "./cards.js";
import {
  addChecklist,
  addChecklistItem,
  getChecklists,
  setChecklistItemState,
} from "./checklists.js";
import type { ToolDef } from "./define.js";
import { search } from "./search.js";

export const allTools: ToolDef[] = [
  // Leitura (read-only mode registra só estas).
  listBoards,
  getBoard,
  getLists,
  getCardsInList,
  getCard,
  getComments,
  getChecklists,
  search,
  // Escrita.
  createList,
  createCard,
  updateCard,
  moveCard,
  archiveCard,
  addComment,
  addChecklist,
  addChecklistItem,
  setChecklistItemState,
];

/**
 * Tools ativas para a config atual. Em read-only, as tools de escrita nunca
 * são registradas (NFR-9) — a garantia é por não-registro, não por checagem
 * em runtime.
 */
export function activeTools(config: Pick<Config, "readOnly">): ToolDef[] {
  return config.readOnly
    ? allTools.filter((tool) => tool.readOnly)
    : allTools;
}
