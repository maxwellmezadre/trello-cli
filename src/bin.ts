#!/usr/bin/env bun
// Import estático de JSON: o bundler (Bun/tsx) embute a versão, então funciona
// também no binário compilado (`bun build --compile`), onde não há
// package.json ao lado do executável.
import pkg from "../package.json" with { type: "json" };

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
