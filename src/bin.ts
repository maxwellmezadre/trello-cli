#!/usr/bin/env bun
import { readFileSync } from "node:fs";

// Lê a versão do package.json em runtime — funciona em Bun e Node ESM sem
// import assertions (que ainda divergem entre runtimes).
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

// ponytail: parsing completo da CLU (commander) chega na etapa 016. Por ora,
// `--version` e o subcomando `mcp`. Lazy-import por modo mantém o cold start
// baixo (NFR-1) — só o caminho usado carrega suas dependências.
const arg = process.argv[2];
if (arg === "--version" || arg === "-v") {
  console.log(pkg.version);
} else if (arg === "mcp") {
  const [{ loadConfig }, { createContext }, { startMcpServer }] =
    await Promise.all([
      import("./config.js"),
      import("./context.js"),
      import("./mcp/server.js"),
    ]);
  const ctx = createContext(loadConfig());
  await startMcpServer(ctx, pkg.version);
} else {
  console.log(`trello-cli ${pkg.version}`);
}
