# Changelog

Todas as mudanças notáveis deste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [0.2.0] - 2026-08-18

### Added

- Remoção de anexos, fechando o ciclo que só ia até anexar/baixar: tools
  `delete_card_attachment` e `delete_all_card_attachments` (esta exige
  `confirm: true` como guarda contra remoção em massa acidental por um agente).
- Comandos `trello delete-attachment` e `trello delete-all-attachments`, com
  confirmação interativa por padrão e `-y/--yes` para script. Sem TTY e sem
  `-y`, o comando recusa em vez de apagar em silêncio.

### Fixed

- Contagem de tools desatualizada no README e em `docs/TOOLS.md`.

## [0.1.0] - 2026-07-08

### Added

- Núcleo compartilhado: `TrelloClient` (leitura + escrita), rate limiter com
  backoff (`Retry-After`), cache TTL/LRU de metadados.
- 22 tools MCP com schema TypeBox único (tipos + validação + JSON Schema) e
  servidor MCP stdio (`trello mcp`).
- CLI `trello` sobre o mesmo núcleo, com `--json` e o comando `archive-board`.
- Download de anexos com auth OAuth por header para uploads, allowlist de host
  (SSRF), teto de tamanho e stream a disco; bulk download com concorrência
  limitada e `_manifest.json`.
- Anexos como resources MCP (`trello://`) e inline de imagens pequenas.
- Modos read-only (write tools não registradas) e compact.
- Logger em stderr com redação de token; `SKILL.md`; documentação completa
  (README, ARCHITECTURE, CONFIGURATION, TOOLS, CLI, USAGE, PRD, ADRs).

[Unreleased]: https://github.com/maxwellmezadre/trello-cli/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/maxwellmezadre/trello-cli/releases/tag/v0.2.0
[0.1.0]: https://github.com/maxwellmezadre/trello-cli/releases/tag/v0.1.0
