# Uso

Walkthrough de ponta a ponta e receitas comuns.

## Setup (uma vez)

```sh
git clone https://github.com/maxwellmezadre/trello-cli.git
cd trello-cli && bun install
bun link                       # `trello` no PATH

export TRELLO_API_KEY="sua-key"   # https://trello.com/app-key
export TRELLO_TOKEN="seu-token"

trello boards                  # confirma que funciona
```

## Descobrir IDs

```sh
trello boards --json                       # pega o boardId
trello lists <boardId> --json              # pega listIds
trello cards <listId> --json               # pega cardIds
```

## Receitas

### Mover um card e comentar

```sh
trello move-card <cardId> <listaDestinoId>
trello comment <cardId> "Movido para revisão"
```

### Criar um card com checklist

```sh
CARD=$(trello create-card <listId> "Nova tarefa" --json | jq -r .id)
trello add-checklist "$CARD" "Passos"
trello card "$CARD"
```

### Baixar todos os anexos de um card

```sh
trello download-all <cardId> --dest ./anexos
cat ./anexos/_manifest.json    # ok/failed por anexo
```

### Exportar um board inteiro

```sh
trello archive-board <boardId> --out ./export
# ./export/board.json + ./export/cards/<id>/... + ./export/_manifest.json
```

### Rodar como servidor MCP para um agente

```sh
trello mcp                     # stdio; ver README para config do Claude
```

## Modos

- **Read-only:** `TRELLO_READ_ONLY=1 trello mcp` — só leitura/download, seguro
  para um agente menos confiável.
- **Compact:** `TRELLO_COMPACT=1` reduz o tamanho das respostas; por chamada,
  passe `compact` (MCP) para sobrepor o default.

Referências: [CLI](CLI.md) · [Tools](TOOLS.md) · [Configuração](CONFIGURATION.md).
