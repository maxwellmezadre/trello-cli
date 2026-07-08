# Configuração

Toda a configuração vem do ambiente (12-factor) e é validada no startup —
faltando algo obrigatório, o processo sai imediatamente com uma mensagem
acionável. Fonte de verdade: [`src/config.ts`](../src/config.ts).

## Obrigatórias

| Variável | Descrição |
| --- | --- |
| `TRELLO_API_KEY` | Chave da API. Gere em <https://trello.com/app-key>. |
| `TRELLO_TOKEN` | Token da API, gerado a partir da chave. |

## Opcionais

| Variável | Default | Descrição |
| --- | --- | --- |
| `TRELLO_READ_ONLY` | `false` | Quando ligado, as write tools **não são registradas** (só leitura/download). |
| `TRELLO_COMPACT` | `false` | Respostas mínimas por padrão (pode ser sobreposto por chamada). |
| `TRELLO_DOWNLOAD_DIR` | `./trello-downloads` | Diretório padrão de downloads. |
| `TRELLO_DOWNLOAD_IMAGES` | `false` | Inline de imagens pequenas no `get_card` (MCP). |
| `TRELLO_MAX_INLINE_IMAGE_BYTES` | `262144` (256 KiB) | Teto de tamanho para imagem inline. |
| `TRELLO_MAX_DOWNLOAD_BYTES` | `52428800` (50 MiB) | Teto por download (Content-Length e stream). |
| `TRELLO_ALLOWED_ATTACHMENT_HOSTS` | `trello.com,api.trello.com,trello-attachments.s3.amazonaws.com` | Allowlist de hosts para download (guarda de SSRF). |
| `TRELLO_DOWNLOAD_CONCURRENCY` | `4` | Downloads simultâneos no bulk (mínimo 1). |
| `TRELLO_CACHE_TTL_MS` | `30000` | TTL do cache de metadados de board/list. `0` desliga. |
| `TRELLO_LOG_FILE` | — | Caminho de arquivo de log (diagnóstico; logs sempre em stderr). |
| `TRELLO_BOARD_ID` | — | Board padrão para fluxos que aceitam um board implícito. |

## Notas

- **Parsing estrito:** valores de boolean (`1/0`, `true/false`, `yes/no`,
  `on/off`) e de número são validados; um valor inválido falha com mensagem, em
  vez de cair silenciosamente num default.
- **Segredos:** `TRELLO_API_KEY`/`TRELLO_TOKEN` vêm só do ambiente, nunca são
  logados (redação automática) e o stdout fica reservado ao JSON-RPC do MCP.
