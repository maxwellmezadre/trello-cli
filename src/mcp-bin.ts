#!/usr/bin/env node
// Entry do binário `trello-mcp`: sobe o servidor MCP direto (sem subcomando).
import pkg from "../package.json" with { type: "json" };
import { loadConfig } from "./config.js";
import { createContext } from "./context.js";
import { startMcpServer } from "./mcp/server.js";

await startMcpServer(createContext(loadConfig()), pkg.version);
