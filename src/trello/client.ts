import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { TtlLruCache } from "../core/cache.js";
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

export type Label = {
  id: string;
  name: string;
  color: string | null;
  idBoard: string;
};

export type Member = {
  id: string;
  fullName: string;
  username: string;
};

export type CustomField = {
  id: string;
  name: string;
  type: string;
  options?: Array<{ id: string; value: { text?: string } }>;
};

export type CustomFieldItem = {
  id: string;
  idCustomField: string;
  idValue?: string;
  value?: Record<string, string>;
};

export type CustomFieldValueType =
  | "text"
  | "number"
  | "checked"
  | "date"
  | "list";

export type Attachment = {
  id: string;
  name: string;
  url: string;
  bytes: number | null;
  date: string;
  mimeType: string | null;
};

export type SearchResult = {
  boards: Board[];
  cards: Card[];
  organizations?: Array<{ id: string; name: string; displayName?: string }>;
};

export type SearchInput = {
  query: string;
  modelTypes?: string;
  boardsLimit?: number;
  cardsLimit?: number;
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
  getBoardCards(boardId: string): Promise<Card[]>;
  getCard(cardId: string): Promise<Card>;
  getComments(cardId: string): Promise<CardComment[]>;
  getChecklists(cardId: string): Promise<Checklist[]>;
  createList(input: { idBoard: string; name: string }): Promise<List>;
  createCard(input: CardCreateInput): Promise<Card>;
  updateCard(cardId: string, fields: CardUpdateInput): Promise<Card>;
  moveCard(cardId: string, listId: string, pos?: number | string): Promise<Card>;
  archiveCard(cardId: string): Promise<Card>;
  addComment(cardId: string, text: string): Promise<CardComment>;
  addChecklist(cardId: string, name: string): Promise<Checklist>;
  addChecklistItem(
    checklistId: string,
    name: string,
    checked?: boolean,
  ): Promise<CheckItem>;
  setChecklistItemState(
    cardId: string,
    checkItemId: string,
    state: "complete" | "incomplete",
  ): Promise<CheckItem>;
  search(input: SearchInput): Promise<SearchResult>;
  getCardAttachments(cardId: string): Promise<Attachment[]>;
  attachUrlToCard(cardId: string, url: string): Promise<Attachment>;
  attachFileToCard(
    cardId: string,
    filePath: string,
    name?: string,
  ): Promise<Attachment>;
  getBoardLabels(boardId: string): Promise<Label[]>;
  createLabel(input: {
    idBoard: string;
    name: string;
    color?: string;
  }): Promise<Label>;
  addLabelToCard(cardId: string, labelId: string): Promise<unknown>;
  getBoardMembers(boardId: string): Promise<Member[]>;
  assignMemberToCard(cardId: string, memberId: string): Promise<unknown>;
  getCustomFields(boardId: string): Promise<CustomField[]>;
  getCardCustomFields(cardId: string): Promise<CustomFieldItem[]>;
  setCardCustomField(
    cardId: string,
    customFieldId: string,
    value: string,
    type?: CustomFieldValueType,
  ): Promise<unknown>;
};

const BOARDS_KEY = "/1/members/me/boards";

export function createTrelloClient(
  http: TrelloHttp,
  cache?: TtlLruCache<unknown>,
): TrelloClient {
  // Só metadados de board/list são cacheados (leitura fria). Cards/anexos são
  // dados quentes e ficam de fora (risco de staleness).
  function cachedGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (!cache) return fetcher();
    const hit = cache.get(key) as T | undefined;
    if (hit !== undefined) return Promise.resolve(hit);
    return fetcher().then((value) => {
      cache.set(key, value);
      return value;
    });
  }

  const updateCard = (cardId: string, fields: CardUpdateInput): Promise<Card> =>
    http.request<Card>(`/1/cards/${cardId}`, {
      method: "PUT",
      query: { ...fields },
    });

  return {
    listBoards() {
      return cachedGet(BOARDS_KEY, () => http.request<Board[]>(BOARDS_KEY));
    },
    getBoard(boardId, opts) {
      const key = `/1/boards/${boardId}?lists=${opts?.withLists ? "open" : "none"}`;
      return cachedGet(key, () =>
        http.request<Board>(`/1/boards/${boardId}`, {
          query: { lists: opts?.withLists ? "open" : undefined },
        }),
      );
    },
    getLists(boardId) {
      return cachedGet(`/1/boards/${boardId}/lists`, () =>
        http.request<List[]>(`/1/boards/${boardId}/lists`),
      );
    },
    getCardsInList(listId) {
      return http.request<Card[]>(`/1/lists/${listId}/cards`);
    },
    getBoardCards(boardId) {
      return http.request<Card[]>(`/1/boards/${boardId}/cards`);
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
      return http
        .request<List>("/1/lists", {
          method: "POST",
          query: { idBoard: input.idBoard, name: input.name },
        })
        .then((list) => {
          // Nova lista muda o board: invalida board/lists cacheados desse board.
          cache?.invalidatePrefix(`/1/boards/${input.idBoard}`);
          cache?.delete(BOARDS_KEY);
          return list;
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
    addComment(cardId, text) {
      return http.request<CardComment>(`/1/cards/${cardId}/actions/comments`, {
        method: "POST",
        query: { text },
      });
    },
    addChecklist(cardId, name) {
      return http.request<Checklist>(`/1/cards/${cardId}/checklists`, {
        method: "POST",
        query: { name },
      });
    },
    addChecklistItem(checklistId, name, checked) {
      return http.request<CheckItem>(`/1/checklists/${checklistId}/checkItems`, {
        method: "POST",
        query: { name, checked },
      });
    },
    setChecklistItemState(cardId, checkItemId, state) {
      // Endpoint card-scoped: /1/cards/{idCard}/checkItem/{idCheckItem}.
      return http.request<CheckItem>(
        `/1/cards/${cardId}/checkItem/${checkItemId}`,
        { method: "PUT", query: { state } },
      );
    },
    search(input) {
      return http.request<SearchResult>("/1/search", {
        query: {
          query: input.query,
          modelTypes: input.modelTypes,
          partial: true,
          boards_limit: input.boardsLimit,
          cards_limit: input.cardsLimit,
        },
      });
    },
    getCardAttachments(cardId) {
      return http.request<Attachment[]>(`/1/cards/${cardId}/attachments`);
    },
    attachUrlToCard(cardId, url) {
      return http.request<Attachment>(`/1/cards/${cardId}/attachments`, {
        method: "POST",
        query: { url },
      });
    },
    async attachFileToCard(cardId, filePath, name) {
      const data = await readFile(filePath);
      const form = new FormData();
      // `file` é o campo esperado pela Trello; content-type/boundary vêm
      // automaticamente do FormData nativo (Bun e Node ≥ 18).
      form.append("file", new Blob([data]), name ?? basename(filePath));
      return http.request<Attachment>(`/1/cards/${cardId}/attachments`, {
        method: "POST",
        body: form,
      });
    },
    getBoardLabels(boardId) {
      return http.request<Label[]>(`/1/boards/${boardId}/labels`);
    },
    createLabel(input) {
      return http.request<Label>("/1/labels", {
        method: "POST",
        query: { idBoard: input.idBoard, name: input.name, color: input.color },
      });
    },
    addLabelToCard(cardId, labelId) {
      return http.request(`/1/cards/${cardId}/idLabels`, {
        method: "POST",
        query: { value: labelId },
      });
    },
    getBoardMembers(boardId) {
      return http.request<Member[]>(`/1/boards/${boardId}/members`);
    },
    assignMemberToCard(cardId, memberId) {
      return http.request(`/1/cards/${cardId}/idMembers`, {
        method: "POST",
        query: { value: memberId },
      });
    },
    getCustomFields(boardId) {
      return http.request<CustomField[]>(`/1/boards/${boardId}/customFields`);
    },
    getCardCustomFields(cardId) {
      return http.request<CustomFieldItem[]>(
        `/1/cards/${cardId}/customFieldItems`,
      );
    },
    setCardCustomField(cardId, customFieldId, value, type = "text") {
      // Item de custom field exige body JSON tipado. Para listas (dropdown), o
      // valor é o id da opção (idValue); para os demais tipos, o valor tipado.
      const json =
        type === "list" ? { idValue: value } : { value: { [type]: value } };
      return http.request(
        `/1/cards/${cardId}/customField/${customFieldId}/item`,
        { method: "PUT", json },
      );
    },
  };
}
