import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Ctx } from "../context.js";
import {
  collectInlineImages,
  readCardAttachmentResource,
} from "../trello/attachments.js";
import { runTool } from "../tools/define.js";
import { activeTools } from "../tools/registry.js";

const ATTACHMENT_URI = /^trello:\/\/cards\/([^/]+)\/attachments\/([^/]+)$/;

// Adapter de transporte MCP (AR-2/AR-9): todo uso do SDK fica confinado aqui.
// Usamos o Server LOW-LEVEL de propósito — o `registerTool` de alto nível
// espera schemas Standard/Zod, e aqui anunciamos o JSON Schema do TypeBox
// diretamente como `inputSchema` (fonte única de verdade, AR-5; ADR-0005).

export async function startMcpServer(ctx: Ctx, version: string): Promise<void> {
  // Read-only mode filtra as write tools por não-registro (NFR-9).
  const tools = activeTools(ctx.config);

  const server = new Server(
    { name: "trello-cli", version },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      // O objeto TypeBox É um JSON Schema válido de objeto.
      inputSchema: tool.input as { type: "object" },
    })),
  }));

  // Não há um escopo natural para listar resources sem um card; a resolução é
  // por URI (trello://cards/{cardId}/attachments/{id}) via ReadResource.
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const match = ATTACHMENT_URI.exec(uri);
    if (!match) throw new Error(`Unsupported resource URI: ${uri}`);
    const [, cardId, attachmentId] = match;
    const resource = await readCardAttachmentResource(
      ctx,
      cardId as string,
      attachmentId as string,
    );
    return {
      contents: [{ uri, mimeType: resource.mimeType, blob: resource.base64 }],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((candidate) => candidate.name === request.params.name);
    if (!tool) {
      return toolError(`Unknown tool: ${request.params.name}`);
    }

    // Falhas de validação/execução viram tool error (isError), nunca crash do
    // processo (AR-7/NFR-11).
    try {
      const args = request.params.arguments ?? {};
      const result = await runTool(tool, args, ctx);
      const content: Array<Record<string, unknown>> = [
        { type: "text", text: JSON.stringify(result, null, 2) },
      ];

      // F-15: inline de imagens pequenas no get_card (best-effort; uma falha
      // aqui não derruba a resposta da tool).
      if (tool.name === "get_card" && ctx.config.downloadImages) {
        try {
          const cardId = (args as { cardId?: string }).cardId;
          if (cardId) {
            const images = await collectInlineImages(ctx, cardId);
            for (const image of images) {
              content.push({
                type: "image",
                data: image.base64,
                mimeType: image.mimeType,
              });
            }
          }
        } catch {
          // ignora falha de inline — a resposta principal já está pronta.
        }
      }

      return { content };
    } catch (error) {
      return toolError(error instanceof Error ? error.message : String(error));
    }
  });

  await server.connect(new StdioServerTransport());
}

function toolError(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}
