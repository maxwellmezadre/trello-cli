import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Prova que o harness `bun test` roda e que o pacote é ESM com versão semver.
test("package.json is esm with a semver version", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { type: string; version: string };

  expect(pkg.type).toBe("module");
  expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
});
