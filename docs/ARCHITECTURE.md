# Arquitetura

`trello-cli` segue uma arquitetura em camadas **ports-and-adapters
(hexagonal-lite)**, pragmática (sem contêiner de DI, sem cerimônia de
repositório). A regra de dependência aponta sempre para dentro:

```
        ┌─────────────────────────────────────────────┐
        │  Transport / Entrypoints                     │
        │  src/bin.ts · src/cli/ · src/mcp/            │
        └───────────────┬─────────────────────────────┘
                        │ (usa)
        ┌───────────────▼─────────────────────────────┐
        │  Application                                 │
        │  src/tools/  (registry + defineTool)         │
        │  src/context.ts  (injeção)                   │
        └───────────────┬─────────────────────────────┘
                        │ (usa)
        ┌───────────────▼─────────────────────────────┐
        │  Domain                                      │
        │  src/trello/  (TrelloClient, attachments,    │
        │                shape) — sem MCP/CLI           │
        └───────────────┬─────────────────────────────┘
                        │ (usa)
        ┌───────────────▼─────────────────────────────┐
        │  Infrastructure                              │
        │  src/core/  (http, cache, logger)  ·  config │
        └─────────────────────────────────────────────┘
```

**Regra de dependência (AR-1):** camadas internas nunca importam de camadas
externas. O domínio (`TrelloClient`) **não** conhece o SDK do MCP nem o
commander (AR-3).

## Camadas

- **Transport** — `src/mcp/server.ts` (adapter stdio do MCP SDK) e `src/cli/`
  (commander). Todo uso do SDK/commander fica confinado aqui (AR-2/AR-9), então
  o núcleo é reutilizável por qualquer transporte.
- **Application** — `src/tools/` define cada tool com um schema TypeBox único
  (tipos + validação + JSON Schema, AR-5) e o `registry`. `src/context.ts` faz
  a injeção explícita dos colaboradores (AR-6).
- **Domain** — `src/trello/` (`client.ts`, `attachments.ts`, `shape.ts`).
  Operações REST puras e a lógica sensível de download de anexos.
- **Infrastructure** — `src/core/` (`http.ts` com rate limiter + backoff,
  `cache.ts` TTL/LRU, `logger.ts`) e `src/config.ts` (12-factor, fail-fast).

## Princípios

- **Schema-first (AR-5):** um `Type.Object(...)` TypeBox por tool é a fonte
  única de verdade. Ver [ADR-0003](adr/0003-typebox-from-start.md).
- **Erros tipados e não-fatais (AR-7):** falhas viram tool errors (`isError`),
  o processo não cai.
- **Config 12-factor (AR-8):** tudo do ambiente, validado no startup.
- **Fronteiras de adapter (AR-9):** MCP SDK e API do Trello atrás de adapters.
- **Segurança por construção:** read-only por não-registro, allowlist de host
  (SSRF), teto de tamanho, token nunca logado.

Decisões registradas em [docs/adr/](adr/).
