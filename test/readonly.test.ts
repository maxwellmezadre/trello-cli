import { describe, expect, test } from "bun:test";
import { activeTools, allTools } from "../src/tools/registry.js";

describe("read-only mode", () => {
  test("excludes every write tool by the readOnly flag", () => {
    const writeTools = allTools.filter((tool) => !tool.readOnly);
    // Guarda: se não houvesse write tools, o teste seria vazio.
    expect(writeTools.length).toBeGreaterThan(0);

    const active = activeTools({ readOnly: true });
    expect(active.every((tool) => tool.readOnly)).toBe(true);
    for (const writeTool of writeTools) {
      expect(active).not.toContain(writeTool);
    }
  });

  test("registers every tool when not read-only", () => {
    expect(activeTools({ readOnly: false })).toHaveLength(allTools.length);
  });
});
