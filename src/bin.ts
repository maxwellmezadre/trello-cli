#!/usr/bin/env bun
import { readFileSync } from "node:fs";

// Lê a versão do package.json em runtime — funciona em Bun e Node ESM sem
// import assertions (que ainda divergem entre runtimes).
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

// ponytail: stub. O parsing real de comandos (commander) e o subcomando `mcp`
// chegam nas etapas 016 e 006.
const arg = process.argv[2];
if (arg === "--version" || arg === "-v") {
  console.log(pkg.version);
} else {
  console.log(`trello-cli ${pkg.version}`);
}
