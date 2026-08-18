# CLI

`trello <comando> [args] [--json]`. Cada comando monta os argumentos e chama a
mesma tool do MCP (validação e comportamento idênticos). `--json` imprime JSON
puro; erros vão para stderr com código de saída ≠ 0.

## Leitura

| Comando | Descrição |
| --- | --- |
| `trello boards` | Lista os boards |
| `trello board <id> [--with-lists]` | Detalhes de um board |
| `trello lists <boardId>` | Listas de um board |
| `trello cards <listId>` | Cards de uma lista |
| `trello card <id>` | Detalhes de um card |
| `trello comments <cardId>` | Comentários |
| `trello checklists <cardId>` | Checklists |
| `trello search <query>` | Busca universal |
| `trello attachments <cardId>` | Anexos |
| `trello download <cardId> <attachmentId> [--dest <dir>]` | Baixa um anexo |
| `trello download-all <cardId> [--dest <dir>] [--concurrency <n>]` | Baixa todos + manifest |

## Escrita

| Comando | Descrição |
| --- | --- |
| `trello create-list <boardId> <name>` | Cria uma lista |
| `trello create-card <listId> <name> [--desc --due --pos]` | Cria um card |
| `trello update-card <cardId> [--name --desc --due --due-complete]` | Atualiza um card |
| `trello move-card <cardId> <listId> [--pos]` | Move um card |
| `trello archive-card <cardId>` | Arquiva um card |
| `trello comment <cardId> <text>` | Comenta |
| `trello add-checklist <cardId> <name>` | Adiciona checklist |
| `trello add-checklist-item <checklistId> <name> [--checked]` | Adiciona item |
| `trello set-item-state <cardId> <checkItemId> <state>` | `complete`/`incomplete` |
| `trello attach-url <cardId> <url>` | Anexa uma URL |
| `trello attach-file <cardId> <filePath> [--name]` | Upload de arquivo |
| `trello delete-attachment <cardId> <attachmentId> [-y]` | Remove um anexo (irreversível; pede confirmação) |
| `trello delete-all-attachments <cardId> [-y] [--concurrency <n>]` | Remove TODOS os anexos de um card (irreversível) |

## Exportação

| Comando | Descrição |
| --- | --- |
| `trello archive-board <boardId> [--out <dir>]` | Exporta o board inteiro (cards + anexos) + `_manifest.json` |

## MCP

`trello mcp` — sobe o servidor MCP stdio (não é comando do commander; é tratado
direto para manter o cold start baixo).

Em `TRELLO_READ_ONLY=1`, comandos de escrita falham com
`Command unavailable in read-only mode`.
