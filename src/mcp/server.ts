import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Ctx } from "../context.js";
import { runTool } from "../tools/define.js";
import { activeTools } from "../tools/registry.js";

// Adapter de transporte MCP (AR-2/AR-9): todo uso do SDK fica confinado aqui.
// Usamos o Server LOW-LEVEL de propósito — o `registerTool` de alto nível
// espera schemas Standard/Zod, e aqui anunciamos o JSON Schema do TypeBox
// diretamente como `inputSchema` (fonte única de verdade, AR-5; ADR-0005).

export async function startMcpServer(ctx: Ctx, version: string): Promise<void> {
  // Read-only mode filtra as write tools por não-registro (NFR-9).
  const tools = activeTools(ctx.config);

  const server = new Server(
    { name: "trello-cli", version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      // O objeto TypeBox É um JSON Schema válido de objeto.
      inputSchema: tool.input as { type: "object" },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((candidate) => candidate.name === request.params.name);
    if (!tool) {
      return toolError(`Unknown tool: ${request.params.name}`);
    }

    // Falhas de validação/execução viram tool error (isError), nunca crash do
    // processo (AR-7/NFR-11).
    try {
      const result = await runTool(tool, request.params.arguments ?? {}, ctx);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return toolError(error instanceof Error ? error.message : String(error));
    }
  });

  await server.connect(new StdioServerTransport());
}

function toolError(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}
