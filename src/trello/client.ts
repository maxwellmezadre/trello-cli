import type { TrelloHttp } from "../core/http.js";

// Domínio puro (AR-3): só conhece o cliente HTTP. Nada de MCP/CLI aqui.
// Tipos mínimos — apenas os campos que consumimos.

export type Board = {
  id: string;
  name: string;
  closed: boolean;
  url: string;
  desc?: string;
  idOrganization?: string | null;
  lists?: List[];
};

export type List = {
  id: string;
  name: string;
  closed: boolean;
  idBoard: string;
  pos: number;
};

export type Card = {
  id: string;
  name: string;
  desc: string;
  idList: string;
  idBoard: string;
  closed: boolean;
  due: string | null;
  dueComplete?: boolean;
  url: string;
  shortUrl: string;
  idLabels: string[];
  idMembers?: string[];
};

/** Ação `commentCard` — só os campos úteis do comentário. */
export type CardComment = {
  id: string;
  date: string;
  data: { text: string };
  memberCreator: { id: string; fullName: string; username: string } | null;
};

export type CheckItem = {
  id: string;
  name: string;
  state: "complete" | "incomplete";
  pos: number;
  idChecklist: string;
};

export type Checklist = {
  id: string;
  name: string;
  idCard: string;
  pos: number;
  checkItems: CheckItem[];
};

export type TrelloClient = {
  listBoards(): Promise<Board[]>;
  getBoard(boardId: string, opts?: { withLists?: boolean }): Promise<Board>;
  getLists(boardId: string): Promise<List[]>;
  getCardsInList(listId: string): Promise<Card[]>;
  getCard(cardId: string): Promise<Card>;
  getComments(cardId: string): Promise<CardComment[]>;
  getChecklists(cardId: string): Promise<Checklist[]>;
};

export function createTrelloClient(http: TrelloHttp): TrelloClient {
  return {
    listBoards() {
      return http.request<Board[]>("/1/members/me/boards");
    },
    getBoard(boardId, opts) {
      return http.request<Board>(`/1/boards/${boardId}`, {
        query: { lists: opts?.withLists ? "open" : undefined },
      });
    },
    getLists(boardId) {
      return http.request<List[]>(`/1/boards/${boardId}/lists`);
    },
    getCardsInList(listId) {
      return http.request<Card[]>(`/1/lists/${listId}/cards`);
    },
    getCard(cardId) {
      return http.request<Card>(`/1/cards/${cardId}`);
    },
    getComments(cardId) {
      return http.request<CardComment[]>(`/1/cards/${cardId}/actions`, {
        query: { filter: "commentCard" },
      });
    },
    getChecklists(cardId) {
      return http.request<Checklist[]>(`/1/cards/${cardId}/checklists`, {
        query: { checkItems: "all" },
      });
    },
  };
}
