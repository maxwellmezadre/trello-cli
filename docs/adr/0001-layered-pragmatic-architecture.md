# ADR-0001 — Arquitetura em camadas, pragmática

- **Status:** Aceito
- **Contexto:** o produto precisa expor o mesmo núcleo por três interfaces (CLI,
  MCP, Skill) e permanecer fácil de contribuir.

## Decisão

Adotar uma arquitetura em camadas ports-and-adapters (hexagonal-lite):
`transport → application → domain → infrastructure`, com regra de dependência
para dentro. Manter **pragmática**: sem contêiner de DI, sem repositório/unit-of-work,
sem service splitting prematuro. A injeção é feita por um objeto de contexto
simples (`src/context.ts`).

## Consequências

- O domínio (`TrelloClient`) não conhece o transporte — reutilizável por CLI e
  MCP sem mudança.
- Cada abstração precisa se justificar; o custo de contribuição fica baixo.
- Não há a flexibilidade extrema de um framework de DI — aceitável para o escopo.
