#!/usr/bin/env bun
import { readFileSync } from "node:fs";

// Lê a versão do package.json em runtime — funciona em Bun e Node ESM sem
// import assertions (que ainda divergem entre runtimes).
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

// Lazy-import por modo mantém o cold start baixo (NFR-1): o servidor MCP não
// carrega o commander e vice-versa. `mcp` é tratado direto (fast path); todo o
// resto vai para a CLI (commander).
const arg = process.argv[2];
if (arg === "mcp") {
  const [{ loadConfig }, { createContext }, { startMcpServer }] =
    await Promise.all([
      import("./config.js"),
      import("./context.js"),
      import("./mcp/server.js"),
    ]);
  const ctx = createContext(loadConfig());
  await startMcpServer(ctx, pkg.version);
} else {
  const { runCli } = await import("./cli/index.js");
  await runCli(process.argv, pkg.version);
}
