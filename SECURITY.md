# Política de Segurança

## Versões suportadas

O desenvolvimento acontece em `main`; correções de segurança vão para a última
release. Antes da 1.0, apenas a versão mais recente é suportada.

## Reportar uma vulnerabilidade

**Não abra uma issue pública** para vulnerabilidades. Reporte de forma privada
por e-mail para **heronpboares@gmail.com** (ou pelo
[GitHub Security Advisories](https://github.com/maxwellmezadre/trello-cli/security/advisories/new)).

Inclua: descrição, passos de reprodução, impacto e, se possível, uma correção
sugerida. Retorno esperado em até alguns dias.

## Escopo de interesse

Esta é uma ferramenta local, de token único. As áreas mais sensíveis:

- **Vazamento de token** — `TRELLO_API_KEY`/`TRELLO_TOKEN` só vêm do ambiente,
  nunca são logados (redação automática) e o header OAuth de download só é
  enviado a hosts do Trello, jamais a um host externo.
- **SSRF em download de anexos** — downloads são restritos a uma allowlist de
  host (`TRELLO_ALLOWED_ATTACHMENT_HOSTS`), verificada antes de qualquer fetch.
- **Esgotamento de recursos** — teto de tamanho por download e stream direto a
  disco (sem bufferizar o corpo inteiro).

Relatos que contornem qualquer uma dessas proteções são especialmente
bem-vindos.
