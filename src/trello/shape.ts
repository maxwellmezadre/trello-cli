import type { Board, Card, List } from "./client.js";

// Compact mode (F-21): projeções mínimas por entidade para poupar contexto de
// LLM. Precedência: o parâmetro `compact` da chamada sobrepõe o default do env.

export function isCompact(
  perCall: boolean | undefined,
  config: { compact: boolean },
): boolean {
  return perCall ?? config.compact;
}

export function shapeList(list: List, compact: boolean) {
  if (!compact) return list;
  return {
    id: list.id,
    name: list.name,
    closed: list.closed,
    idBoard: list.idBoard,
  };
}

export function shapeBoard(board: Board, compact: boolean) {
  if (!compact) return board;
  return {
    id: board.id,
    name: board.name,
    closed: board.closed,
    url: board.url,
    ...(board.lists
      ? { lists: board.lists.map((list) => shapeList(list, true)) }
      : {}),
  };
}

export function shapeCard(card: Card, compact: boolean) {
  if (!compact) return card;
  // Omite os campos verbosos (desc, badges, etc.), mantém o essencial.
  return {
    id: card.id,
    name: card.name,
    idList: card.idList,
    idBoard: card.idBoard,
    due: card.due,
    closed: card.closed,
    idLabels: card.idLabels,
  };
}
