# Tools

22 tools sobre o núcleo compartilhado. Fonte de verdade:
[`src/tools/registry.ts`](../src/tools/registry.ts). As de leitura ficam
disponíveis também em read-only (`TRELLO_READ_ONLY=1`); as de escrita não são
registradas nesse modo.

## Leitura

| Tool | Parâmetros | Descrição |
| --- | --- | --- |
| `list_boards` | `compact?` | Lista os boards do usuário. |
| `get_board` | `boardId`, `withLists?`, `compact?` | Detalhes de um board. |
| `get_lists` | `boardId`, `compact?` | Listas de um board. |
| `get_cards_in_list` | `listId`, `compact?` | Cards de uma lista. |
| `get_card` | `cardId`, `compact?` | Detalhes de um card. |
| `get_comments` | `cardId` | Comentários de um card. |
| `get_checklists` | `cardId` | Checklists e itens de um card. |
| `search` | `query`, `modelTypes?`, `boardsLimit?`, `cardsLimit?` | Busca universal. |
| `get_card_attachments` | `cardId` | Anexos, marcando uploads vs. links + URI `trello://`. |
| `download_attachment` | `cardId`, `attachmentId`, `destDir?` | Baixa um anexo (auth OAuth para uploads). |
| `download_all_card_attachments` | `cardId`, `destDir?`, `concurrency?` | Baixa todos + `_manifest.json`. |

## Escrita

| Tool | Parâmetros | Descrição |
| --- | --- | --- |
| `create_list` | `boardId`, `name` | Cria uma lista. |
| `create_card` | `listId`, `name`, `desc?`, `due?`, `pos?` | Cria um card. |
| `update_card` | `cardId`, `name?`, `desc?`, `due?`, `dueComplete?` | Atualiza um card. |
| `move_card` | `cardId`, `listId`, `pos?` | Move um card para outra lista. |
| `archive_card` | `cardId` | Arquiva um card. |
| `add_comment` | `cardId`, `text` | Adiciona um comentário. |
| `add_checklist` | `cardId`, `name` | Adiciona um checklist. |
| `add_checklist_item` | `checklistId`, `name`, `checked?` | Adiciona um item. |
| `set_checklist_item_state` | `cardId`, `checkItemId`, `state` (`complete\|incomplete`) | Marca/desmarca um item. |
| `attach_url_to_card` | `cardId`, `url` | Anexa uma URL. |
| `attach_file_to_card` | `cardId`, `filePath`, `name?` | Upload de arquivo local (multipart). |

## Resources MCP

Anexos também são expostos como resources legíveis na URI
`trello://cards/{cardId}/attachments/{attachmentId}` (bytes em base64 +
mimeType), reusando o mesmo pipeline com guardas de auth/allowlist/cap do
download.
