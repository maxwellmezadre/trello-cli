# trello-cli

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Runtime: Bun](https://img.shields.io/badge/runtime-Bun%20%7C%20Node%20%E2%89%A518-black)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](tsconfig.json)

Um CLI para o Trello que **também** embute um servidor MCP e uma Skill, sobre um
núcleo compartilhado. Instale uma vez e use nos três: terminal, agentes de IA
(Claude Code / Desktop) e scripts.

O diferencial: **baixar anexos enviados por upload funciona de verdade**. Essas
URLs exigem um header `Authorization: OAuth ...` — passar `key`/`token` na query
(o que funciona no resto da API) devolve uma página de login HTML ou `401`. A
maioria das ferramentas erra isso; esta trata sozinha.

## Sumário

- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso — CLI](#uso--cli)
- [Uso — MCP](#uso--mcp)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Tools](#tools)
- [Troubleshooting](#troubleshooting)
- [Documentação](#documentação)

## Instalação

Requer [Bun](https://bun.sh) (recomendado) ou Node ≥ 18.

```sh
git clone https://github.com/maxwellmezadre/trello-cli.git
cd trello-cli
bun install
```

Rode com `bun run src/bin.ts <comando>`. Para instalar o binário `trello` no PATH:

```sh
bun link            # disponibiliza `trello` globalmente
```

> **Planejado:** publicação em npm (`npx trello-cli ...` / `bunx trello-cli ...`)
> e binários pré-compilados nas Releases. Veja os
> [milestones M4](docs/PRD.md#10-milestones).

## Configuração

Gere sua chave e token em <https://trello.com/app-key> e exporte:

```sh
export TRELLO_API_KEY="sua-key"
export TRELLO_TOKEN="seu-token"
```

Pronto — a primeira chamada já funciona:

```sh
trello boards
```

Sem as duas variáveis, qualquer comando falha imediatamente com uma mensagem
que diz o que falta e onde obter.

## Uso — CLI

```sh
trello boards --json                 # lista boards em JSON
trello lists <boardId>               # listas de um board
trello card <cardId>                 # detalhes de um card
trello move-card <cardId> <listId>   # move um card
trello comment <cardId> "texto"      # comenta
trello download <cardId> <attId>     # baixa um anexo (auth OAuth automática)
trello download-all <cardId>         # baixa todos + _manifest.json
trello archive-board <boardId> --out ./export
```

Qualquer comando aceita `--json` para saída estruturada. Veja todos em
[docs/CLI.md](docs/CLI.md).

## Uso — MCP

Rode o servidor stdio:

```sh
trello mcp
```

Configuração para o Claude Desktop / Claude Code (`mcpServers`):

```json
{
  "mcpServers": {
    "trello": {
      "command": "trello",
      "args": ["mcp"],
      "env": {
        "TRELLO_API_KEY": "sua-key",
        "TRELLO_TOKEN": "seu-token"
      }
    }
  }
}
```

As 30 tools ficam disponíveis ao agente; anexos também como resources
`trello://cards/{cardId}/attachments/{attachmentId}`.

## Variáveis de ambiente

| Variável | Obrigatória | Default | Descrição |
| --- | --- | --- | --- |
| `TRELLO_API_KEY` | sim | — | Chave da API |
| `TRELLO_TOKEN` | sim | — | Token da API |
| `TRELLO_READ_ONLY` | não | `0` | Só leitura/download (write tools não registradas) |
| `TRELLO_COMPACT` | não | `0` | Respostas mínimas por padrão |
| `TRELLO_DOWNLOAD_DIR` | não | `./trello-downloads` | Destino dos downloads |
| `TRELLO_DOWNLOAD_IMAGES` | não | `0` | Inline de imagens pequenas no `get_card` (MCP) |
| `TRELLO_MAX_INLINE_IMAGE_BYTES` | não | `262144` | Teto de imagem inline |
| `TRELLO_MAX_DOWNLOAD_BYTES` | não | `52428800` | Teto por download |
| `TRELLO_ALLOWED_ATTACHMENT_HOSTS` | não | hosts do Trello | Allowlist de download (SSRF) |
| `TRELLO_DOWNLOAD_CONCURRENCY` | não | `4` | Downloads simultâneos |
| `TRELLO_CACHE_TTL_MS` | não | `30000` | TTL do cache de metadados (0 desliga) |
| `TRELLO_LOG_FILE` | não | — | Arquivo de log (diagnóstico, em stderr) |
| `TRELLO_BOARD_ID` | não | — | Board padrão |

Referência completa: [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Tools

15 de leitura (também em read-only) e 15 de escrita. Resumo:

- **Boards/listas/cards:** `list_boards`, `get_board`, `get_lists`,
  `get_cards_in_list`, `get_card`, `create_list`, `create_card`, `update_card`,
  `move_card`, `archive_card`.
- **Checklists/comentários:** `get_checklists`, `add_checklist`,
  `add_checklist_item`, `set_checklist_item_state`, `get_comments`,
  `add_comment`.
- **Anexos:** `get_card_attachments`, `download_attachment`,
  `download_all_card_attachments`, `attach_url_to_card`, `attach_file_to_card`.
- **Labels/membros/campos:** `get_board_labels`, `create_label`,
  `add_label_to_card`, `get_board_members`, `assign_member_to_card`,
  `get_custom_fields`, `get_card_custom_fields`, `set_card_custom_field`.
- **Busca:** `search`.

Parâmetros de cada tool: [docs/TOOLS.md](docs/TOOLS.md).

## Troubleshooting

- **Anexo baixa um HTML de login ou dá 401** — você está baixando por fora da
  ferramenta. Anexos uploaded exigem o header OAuth; use `trello download` /
  `download_attachment`, que o aplicam.
- **`Host not allowed for download`** — o host do anexo não está em
  `TRELLO_ALLOWED_ATTACHMENT_HOSTS`. Adicione-o se confiar na origem.
- **Erros 429 / lentidão** — é o rate limit do Trello (100 req/10s). A
  ferramenta já enfileira em 90/10s e faz backoff; evite paralelizar por fora.
- **`Command unavailable in read-only mode`** — `TRELLO_READ_ONLY=1` está
  ativo; comandos de escrita ficam indisponíveis. Remova a flag para escrever.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md) · [Configuração](docs/CONFIGURATION.md) ·
  [Tools](docs/TOOLS.md) · [CLI](docs/CLI.md) · [Uso](docs/USAGE.md) ·
  [PRD](docs/PRD.md) · [ADRs](docs/adr/)

## Licença

[MIT](LICENSE).
