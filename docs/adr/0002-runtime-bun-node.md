# ADR-0002 — Runtime: Bun default, Node ≥ 18 compatível

- **Status:** Aceito
- **Contexto:** precisamos de cold start baixo, execução direta de TypeScript e
  uma opção de binário único, sem perder o SDK MCP em TypeScript.

## Decisão

Usar **Bun** como runtime padrão (roda TS direto, cold start rápido,
`bun build --compile` para binário único) e manter compatibilidade com
**Node ≥ 18**. Usar apenas APIs web comuns (`fetch`, `FormData`, `Blob`,
Web Streams) para não divergir entre os dois.

## Consequências

- Distribuição por `bunx`/`npx` e por binários pré-compilados.
- O CI roda em Bun e faz um smoke de compatibilidade em Node LTS.
- Go/Rust foram descartados: não aceleram um proxy de I/O rate-limited em
  regime estável e custariam a perda do SDK MCP em TS.
