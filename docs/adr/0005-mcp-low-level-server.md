# ADR-0005 — Server low-level do MCP SDK

- **Status:** Aceito
- **Contexto:** queremos anunciar o JSON Schema do TypeBox diretamente como
  `inputSchema` das tools, mantendo o TypeBox como fonte única de verdade
  (ADR-0003).

## Decisão

Usar o **Server low-level** do `@modelcontextprotocol/sdk`
(`setRequestHandler(ListToolsRequestSchema | CallToolRequestSchema, ...)`) em
vez do `McpServer.registerTool` de alto nível, que espera schemas Standard/Zod.
O low-level deixa passar o objeto TypeBox (que já é um JSON Schema válido)
diretamente no `inputSchema`.

Todo o uso do SDK fica confinado a `src/mcp/server.ts` (fronteira de adapter,
AR-9). Falhas de validação/execução viram tool errors (`isError`), nunca crash.

## Consequências

- Sem ponte Zod↔TypeBox; uma fonte de verdade só.
- Acoplamento à API low-level do SDK — mitigado por pin de versão e pelo
  isolamento em um único arquivo.
