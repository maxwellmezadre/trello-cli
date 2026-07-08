# ADR-0004 — Auth OAuth por header para anexos uploaded

- **Status:** Aceito
- **Contexto:** é o diferencial de confiabilidade do produto. Baixar um anexo
  **enviado por upload** ao Trello com `key`/`token` na query — que funciona no
  resto da API — retorna uma página de login HTML ou `401`.

## Decisão

Para URLs de anexo em hosts de upload do Trello (`trello.com`, `api.trello.com`,
`trello-attachments.s3.amazonaws.com`), enviar o header
`Authorization: OAuth oauth_consumer_key="KEY", oauth_token="TOKEN"`. O header é
enviado **somente** a esses hosts — nunca a um host externo, para não vazar o
token. A classificação upload-vs-link é por host (não pelo campo `isUpload` da
API), pois é o host que decide o esquema de autenticação.

Guardas associadas: allowlist de host (SSRF) verificada antes do fetch, teto de
tamanho (Content-Length + stream), stream direto a disco.

## Consequências

- A lógica sensível fica num único ponto (`src/trello/attachments.ts`), com
  comentário explicativo e o conjunto de testes mais crítico do repo.
- Um teste de integração real (gated) protege contra o Trello mudar a auth de
  novo.
