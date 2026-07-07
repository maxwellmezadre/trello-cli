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

export type CardCreateInput = {
  idList: string;
  name: string;
  desc?: string;
  due?: string;
  pos?: number | string;
};

export type CardUpdateInput = {
  name?: string;
  desc?: string;
  due?: string;
  dueComplete?: boolean;
  idList?: string;
  closed?: boolean;
  pos?: number | string;
};

export type TrelloClient = {
  listBoards(): Promise<Board[]>;
  getBoard(boardId: string, opts?: { withLists?: boolean }): Promise<Board>;
  getLists(boardId: string): Promise<List[]>;
  getCardsInList(listId: string): Promise<Card[]>;
  getCard(cardId: string): Promise<Card>;
  getComments(cardId: string): Promise<CardComment[]>;
  getChecklists(cardId: string): Promise<Checklist[]>;
  createList(input: { idBoard: string; name: string }): Promise<List>;
  createCard(input: CardCreateInput): Promise<Card>;
  updateCard(cardId: string, fields: CardUpdateInput): Promise<Card>;
  moveCard(cardId: string, listId: string, pos?: number | string): Promise<Card>;
  archiveCard(cardId: string): Promise<Card>;
};

export function createTrelloClient(http: TrelloHttp): TrelloClient {
  const updateCard = (cardId: string, fields: CardUpdateInput): Promise<Card> =>
    http.request<Card>(`/1/cards/${cardId}`, {
      method: "PUT",
      query: { ...fields },
    });

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
    createList(input) {
      return http.request<List>("/1/lists", {
        method: "POST",
        query: { idBoard: input.idBoard, name: input.name },
      });
    },
    createCard(input) {
      return http.request<Card>("/1/cards", {
        method: "POST",
        query: {
          idList: input.idList,
          name: input.name,
          desc: input.desc,
          due: input.due,
          pos: input.pos,
        },
      });
    },
    updateCard,
    moveCard(cardId, listId, pos) {
      return updateCard(cardId, { idList: listId, pos });
    },
    archiveCard(cardId) {
      return updateCard(cardId, { closed: true });
    },
  };
}
