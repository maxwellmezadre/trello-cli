# Contribuindo

Obrigado pelo interesse! Contribuições são bem-vindas.

## Setup de desenvolvimento

Requer [Bun](https://bun.sh) (ou Node ≥ 18).

```sh
bun install
bun test            # suíte de testes
bunx tsc --noEmit   # type-check
```

Rode a CLI localmente com `bun run src/bin.ts <comando>`.

## Fluxo

1. Faça um fork e crie uma branch a partir de `main`.
2. Faça a mudança com testes quando ela mudar comportamento (ver abaixo).
3. Garanta `bun test` verde e `tsc --noEmit` limpo.
4. Abra um PR seguindo o template.

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org) sem escopo,
em inglês, uma linha ≤ 72 caracteres:

```
feat: add label tools
fix: honor retry-after on 5xx
docs: clarify attachment auth
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`.

## Testes

Escreva apenas testes de valor real (regras de negócio, segurança, regressão).
Priorize: auth/allowlist/cap de download, rate limiting, read-only, cache,
compact. Evite testes que re-afirmam estruturas estáticas.

### Teste de integração de download (real)

Há um teste que baixa um anexo **real** do Trello (o diferencial). Ele é
_gated_: sem credenciais, é pulado. Para rodá-lo localmente, exporte:

```sh
export TRELLO_API_KEY=...        # https://trello.com/app-key
export TRELLO_TOKEN=...
export TRELLO_TEST_CARD_ID=...   # um card com um anexo enviado por upload
bun test
```

No CI ele roda apenas quando os secrets estão presentes (não em forks).

## Checklist de PR

- [ ] `bun test` verde e `tsc --noEmit` limpo
- [ ] Documentação atualizada quando o comportamento muda
      (`README`, `docs/TOOLS.md`, `docs/CLI.md`, `docs/CONFIGURATION.md`,
      `SKILL.md`)
- [ ] Commits em Conventional Commits
