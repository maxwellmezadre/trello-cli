import type { Config } from "../config.js";
import { getBoard, getLists, listBoards } from "./boards.js";
import { getCard, getCardsInList, getComments } from "./cards.js";
import { getChecklists } from "./checklists.js";
import type { ToolDef } from "./define.js";

export const allTools: ToolDef[] = [
  listBoards,
  getBoard,
  getLists,
  getCardsInList,
  getCard,
  getComments,
  getChecklists,
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
