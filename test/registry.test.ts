import { describe, expect, test } from "bun:test";
import type { Ctx } from "../src/context.js";
import { runTool, ToolInputError } from "../src/tools/define.js";
import { activeTools, allTools } from "../src/tools/registry.js";

function toolNamed(name: string) {
  const tool = allTools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`tool ${name} not found`);
  return tool;
}

describe("runTool validation", () => {
  test("rejects missing and wrong-typed args with a structured error", async () => {
    const getBoard = toolNamed("get_board");
    const ctx = {} as Ctx;

    await expect(runTool(getBoard, {}, ctx)).rejects.toBeInstanceOf(
      ToolInputError,
    );
    await expect(
      runTool(getBoard, { boardId: 123 }, ctx),
    ).rejects.toBeInstanceOf(ToolInputError);
  });

  test("valid args reach the tool run", async () => {
    const getCard = toolNamed("get_card");
    const ctx = {
      trello: { getCard: async (id: string) => ({ id }) },
    } as unknown as Ctx;

    const result = await runTool(getCard, { cardId: "C1" }, ctx);
    expect(result).toEqual({ id: "C1" });
  });
});

describe("activeTools", () => {
  test("read-only mode registers only read-only tools", () => {
    const readOnly = activeTools({ readOnly: true });
    expect(readOnly.every((tool) => tool.readOnly)).toBe(true);
    // Sem write tools ainda, o conjunto completo é read-only.
    expect(activeTools({ readOnly: false })).toHaveLength(allTools.length);
  });
});

describe("tool schemas", () => {
  test("each input serializes to a valid json schema object", () => {
    for (const tool of allTools) {
      const jsonSchema = JSON.parse(JSON.stringify(tool.input)) as {
        type?: string;
      };
      expect(jsonSchema.type).toBe("object");
    }
  });
});
