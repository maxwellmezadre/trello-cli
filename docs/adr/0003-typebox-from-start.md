# ADR-0003 — TypeBox desde o início (Zod descartado)

- **Status:** Aceito
- **Contexto:** o PRD previa uma migração Zod→TypeBox. Na prática, o produto foi
  construído do zero — não havia nenhum schema Zod existente para migrar.

## Decisão

Usar **TypeBox** como fonte única de verdade dos schemas desde o primeiro
commit. Um `Type.Object(...)` por tool produz simultaneamente: os tipos
estáticos (`Static<S>`), a validação em runtime (`Value.Check`) e o JSON Schema
anunciado ao cliente MCP como `inputSchema`. Zod foi descartado — construir com
ele só para migrar depois seria desperdício.

## Consequências

- Zero duplicação de schema; adicionar uma tool custa ~10 linhas.
- O JSON Schema advertido é literalmente o objeto TypeBox (ver
  [ADR-0005](0005-mcp-low-level-server.md)).
