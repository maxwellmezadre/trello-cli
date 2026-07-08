---
name: trello-cli
description: >-
  Use quando o usuário quiser ler ou gerenciar boards do Trello, ou baixar
  anexos de cards — listar/mover/comentar cards, checklists, buscar, e
  especialmente baixar arquivos anexados (o diferencial: anexos "uploaded"
  exigem auth OAuth por header, tratada automaticamente). Triggers: Trello,
  board, card, lista, checklist, anexo, attachment, baixar anexo, mover card,
  arquivar card, exportar board.
---

# trello-cli

CLI + servidor MCP para o Trello sobre um núcleo compartilhado. O diferencial é
baixar **anexos enviados por upload** de forma confiável: essas URLs exigem o
header `Authorization: OAuth ...` (passar `key`/`token` na query devolve uma
página de login/401). A ferramenta faz isso sozinha.

## Configuração (obrigatória)

Variáveis de ambiente:

- `TRELLO_API_KEY`, `TRELLO_TOKEN` — obrigatórias. Gere em <https://trello.com/app-key>.
- Opcionais: `TRELLO_READ_ONLY=1` (só leitura/download), `TRELLO_COMPACT=1`
  (respostas mínimas), `TRELLO_DOWNLOAD_DIR`, `TRELLO_DOWNLOAD_CONCURRENCY`,
  `TRELLO_MAX_DOWNLOAD_BYTES`, `TRELLO_ALLOWED_ATTACHMENT_HOSTS`,
  `TRELLO_DOWNLOAD_IMAGES=1`, `TRELLO_LOG_FILE`.

Sem as duas obrigatórias, qualquer comando falha com uma mensagem clara.

## CLI vs MCP

- **CLI** (`trello <comando>`): para humanos, scripts e execução direta no
  terminal. Aceita `--json` em qualquer comando para saída estruturada.
- **MCP** (`trello mcp`): servidor stdio para agentes (Claude Code/Desktop).
  Mesmas capacidades, expostas como tools. Anexos também ficam disponíveis como
  resources `trello://cards/{cardId}/attachments/{attachmentId}`.

## Tools / comandos

Leitura (disponíveis também em read-only):

| Tool (MCP) | Comando (CLI) | O que faz |
| --- | --- | --- |
| `list_boards` | `trello boards` | Lista os boards |
| `get_board` | `trello board <id> [--with-lists]` | Detalhes de um board |
| `get_lists` | `trello lists <boardId>` | Listas de um board |
| `get_cards_in_list` | `trello cards <listId>` | Cards de uma lista |
| `get_card` | `trello card <id>` | Detalhes de um card |
| `get_comments` | `trello comments <cardId>` | Comentários de um card |
| `get_checklists` | `trello checklists <cardId>` | Checklists de um card |
| `search` | `trello search <query>` | Busca universal |
| `get_card_attachments` | `trello attachments <cardId>` | Anexos (marca uploads) |
| `download_attachment` | `trello download <cardId> <attachmentId>` | Baixa um anexo |
| `download_all_card_attachments` | `trello download-all <cardId>` | Baixa todos + `_manifest.json` |

Escrita (ausentes em read-only):

| Tool (MCP) | Comando (CLI) |
| --- | --- |
| `create_list` | `trello create-list <boardId> <name>` |
| `create_card` | `trello create-card <listId> <name> [--desc --due --pos]` |
| `update_card` | `trello update-card <cardId> [--name --desc --due --due-complete]` |
| `move_card` | `trello move-card <cardId> <listId> [--pos]` |
| `archive_card` | `trello archive-card <cardId>` |
| `add_comment` | `trello comment <cardId> <text>` |
| `add_checklist` | `trello add-checklist <cardId> <name>` |
| `add_checklist_item` | `trello add-checklist-item <checklistId> <name> [--checked]` |
| `set_checklist_item_state` | `trello set-item-state <cardId> <checkItemId> <complete\|incomplete>` |
| `attach_url_to_card` | `trello attach-url <cardId> <url>` |
| `attach_file_to_card` | `trello attach-file <cardId> <filePath> [--name]` |

Exportação (CLI-only): `trello archive-board <boardId> [--out ./dir]` — grava
`board.json` (cards + comentários + checklists) e baixa os anexos de cada card,
com um `_manifest.json` global das falhas.

## Receitas

**Mover um card e comentar:**

```sh
trello move-card <cardId> <listaDestinoId>
trello comment <cardId> "Movido para revisão"
```

**Baixar todos os anexos de um card:**

```sh
trello download-all <cardId> --dest ./anexos
# confira ./anexos/_manifest.json para ver ok/failed
```

**Exportar um board inteiro:**

```sh
trello archive-board <boardId> --out ./export
```

## Avisos

- **Read-only** (`TRELLO_READ_ONLY=1`): comandos/tools de escrita não existem —
  tentar usá-los falha com "read-only mode". Só leitura e download.
- **Rate limit**: o Trello limita 100 req/10s por token; a ferramenta enfileira
  localmente (90/10s) e faz backoff. Não paralelize por fora.
- **Anexos uploaded**: baixe SEMPRE pela ferramenta — o header OAuth é
  obrigatório e é aplicado automaticamente só a hosts do Trello (nunca a links
  externos, para não vazar o token).
