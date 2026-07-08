import { describe, expect, test } from "bun:test";
import type { Board, Card } from "../src/trello/client.js";
import { isCompact, shapeBoard, shapeCard } from "../src/trello/shape.js";

const CARD: Card = {
  id: "C1",
  name: "Task",
  desc: "a very long description ".repeat(20),
  idList: "L1",
  idBoard: "B1",
  closed: false,
  due: null,
  url: "https://trello.com/c/C1",
  shortUrl: "https://trello.com/c/C1",
  idLabels: ["lbl1"],
};

const BOARD: Board = {
  id: "B1",
  name: "Board",
  closed: false,
  url: "https://trello.com/b/B1",
  desc: "board desc",
  idOrganization: "org1",
};

describe("isCompact precedence", () => {
  test("per-call value overrides the env default", () => {
    expect(isCompact(false, { compact: true })).toBe(false);
    expect(isCompact(true, { compact: false })).toBe(true);
  });

  test("falls back to the env default when per-call is undefined", () => {
    expect(isCompact(undefined, { compact: true })).toBe(true);
    expect(isCompact(undefined, { compact: false })).toBe(false);
  });
});

describe("shapeCard", () => {
  test("compact drops verbose fields but keeps essentials", () => {
    const compact = shapeCard(CARD, true);
    expect(compact).not.toHaveProperty("desc");
    expect(compact).not.toHaveProperty("shortUrl");
    expect(compact.id).toBe("C1");
    expect(compact.idList).toBe("L1");
  });

  test("non-compact returns the card unchanged", () => {
    expect(shapeCard(CARD, false)).toBe(CARD);
    expect(shapeCard(CARD, false)).toHaveProperty("desc");
  });
});

describe("shapeBoard", () => {
  test("compact keeps only the summary fields", () => {
    const compact = shapeBoard(BOARD, true);
    expect(compact).toEqual({
      id: "B1",
      name: "Board",
      closed: false,
      url: "https://trello.com/b/B1",
    });
  });
});
