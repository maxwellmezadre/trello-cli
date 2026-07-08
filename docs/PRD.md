# PRD — `trello-cli`

> **Status de implementação (atualizado):** este produto foi construído do zero.
> M0 (produto: 22 tools MCP + CLI + Skill + download OAuth) e M2 (hardening:
> TypeBox desde o início, cache TTL/LRU, downloads com concorrência limitada,
> logger com redação) estão **feitos**; M1 (docs) foi entregue com este conjunto
> de documentos; o teste de integração real de download é gated no CI. M3
> (labels/members/custom fields, resolução nome→id, binário único) e M4
> (publicação npm + releases) são os próximos. A tabela de milestones abaixo é a
> versão original do PRD.

| | |
| --- | --- |
| **Product** | `trello-cli` — a Trello CLI that bundles an MCP server and a Skill |
| **Owner** | Maxwell (solo maintainer) |
| **Status** | Draft v1.2 — public open-source release |
| **Date** | 2026-07-02 |
| **Repo** | `trello-cli` (public, MIT) |

---

## 1. Overview

The Trello MCP landscape is fragmented: each community server or CLI does one
thing well and something else poorly. One has broad tool coverage but can't
download files; another downloads files but has a thin toolset; a third has an
elegant resource model but no rate limiting. There is no single, well-engineered
option a developer can install once and trust for both **managing** boards and
**extracting** attachments.

`trello-cli` consolidates the best ideas into one standardized, performant,
**fully documented** package that offers **three interfaces over a single shared
core**: a **CLI** for humans and scripts, a bundled **MCP server** for AI agents
(Claude Code, Claude Desktop, and others), and a **Skill** that teaches agents
how to use it. Published as a public open-source project. This PRD defines what
"done" looks like — including the architecture and documentation standards a
public repo demands.

### The differentiating problem it solves

Downloading an **uploaded** Trello attachment requires an OAuth `Authorization`
header — passing `key`/`token` as query params (which works for the rest of the
API) returns an HTML login page or a `401`. Most tools get this wrong. Handling
it correctly is the product's core reliability promise.

---

## 2. Goals & non-goals

### Goals

- G1. One install covers the full Trello workflow: boards, lists, cards,
  checklists, comments, labels, members, search, and attachments.
- G2. Attachment download **just works** — uploaded files, single or bulk, to
  disk and as MCP resources.
- G3. Fast to start and cheap to run: near-instant cold start, minimal
  footprint, single-binary distribution option.
- G4. Safe by default: read-only mode, SSRF/host allowlist, size caps, no token
  leakage.
- G5. Trivially extensible: adding a tool is a few lines with one source of
  truth for its schema.
- G6. **Publication-grade**: modern architecture, complete documentation, and
  onboarding that lets a stranger succeed in minutes.

### Non-goals

- N1. A hosted/multi-tenant SaaS. This is a local, single-token server.
- N2. A full Trello UI or Power-Up replacement.
- N3. Re-implementing Trello's Workspace ZIP export (admin/Premium feature).
- N4. Write-heavy automation frameworks (Butler-style rules) — out of scope for v1.

---

## 3. Target users & use cases

**Primary:** solo developers and small teams using Claude Code / Claude Desktop
who track work in Trello and want to read, update, and pull files without
leaving their agent. **Secondary:** open-source contributors extending the tool.

Representative use cases: move a card and comment; download every attachment on a
card; search boards and inspect attachments; run read-only for a less-trusted
agent.

---

## 4. Success metrics

| Metric | Target |
| --- | --- |
| Cold start (server ready) | < 150 ms on Bun |
| Attachment download success (uploaded files, valid & in-cap) | 100% |
| Tool coverage vs. Trello REST core surface | ≥ 90% |
| Rate-limit-induced failures under normal use | ~0 |
| Time to add a new tool | < 10 lines, no schema duplication |
| Install-to-first-successful-call (new user, following README) | < 5 minutes |
| Documentation completeness | README + architecture + config + tools + usage + PRD + ADRs, all current |

---

## 5. Functional requirements

Priority: **P0** = required for v1, **P1** = fast-follow, **P2** = later.

### 5.1 Board / list / card management

| ID | Requirement | Priority |
| --- | --- | --- |
| F-1 | List boards; get board (optionally with lists/cards) | P0 |
| F-2 | Get/create lists | P0 |
| F-3 | Get cards in a list; get full card details | P0 |
| F-4 | Create, update, move, archive cards | P0 |
| F-5 | Labels: list/create/assign | P1 |
| F-6 | Members: list/assign | P1 |
| F-7 | Custom fields: read/set | P2 |

### 5.2 Checklists & comments

| ID | Requirement | Priority |
| --- | --- | --- |
| F-8 | Get checklists with items | P0 |
| F-9 | Add checklist / add item / set item state | P0 |
| F-10 | Get comments; add comment | P0 |

### 5.3 Attachments (core differentiator)

| ID | Requirement | Priority |
| --- | --- | --- |
| F-11 | List attachments; mark uploads vs. links; expose `trello://` URI | P0 |
| F-12 | Download a single attachment to disk (correct OAuth auth for uploads) | P0 |
| F-13 | Bulk-download all attachments on a card + `_manifest.json` | P0 |
| F-14 | Expose attachments as readable MCP **resources** | P0 |
| F-15 | Inline small image attachments in `get_card` (allowlist + size cap) | P0 |
| F-16 | Attach a URL to a card; upload a local file to a card | P0 |
| F-17 | Bulk-export an entire board (all cards + attachments) via CLI (`archive-board`) | P0 |

### 5.4 Search & discovery

| ID | Requirement | Priority |
| --- | --- | --- |
| F-18 | Universal search across boards/cards/orgs | P0 |
| F-19 | Resolve board→list→card by name when given a name | P1 |

### 5.5 Modes & packaging

| ID | Requirement | Priority |
| --- | --- | --- |
| F-20 | Read-only mode (only read/download tools registered) | P0 |
| F-21 | Compact mode (minimal fields), per-call and default | P0 |
| F-22 | Ship as MCP server (stdio), via `trello mcp` and a `trello-mcp` binary | P0 |
| F-23 | Ship as a Skill (`SKILL.md`) | P0 |
| F-24 | Ship a CLI over the same client (`trello`), with `--json` output | P0 |
| F-25 | CLI: whole-board archive (cards + attachments) to disk | P0 |
| F-26 | Optional HTTP/SSE transport | P2 |
| F-27 | Workspace allowlist enforcement (`TRELLO_ALLOWED_WORKSPACES`) | P1 |

---

## 6. Non-functional requirements

### Performance
- NFR-1. Cold start < 150 ms (Bun); the server spawns per session.
- NFR-2. **Steady-state throughput is bounded by Trello (100 req/10s/token).**
  The server must queue locally and never exceed the limit.
- NFR-3. Bulk downloads use **bounded concurrency** (default 4–6).
- NFR-4. Board/list metadata served from a short **TTL cache**.

### Reliability
- NFR-5. Token-bucket rate limiting + exponential backoff honoring `Retry-After`.
- NFR-6. Bulk operations are fault-tolerant; failures recorded in the manifest.

### Security
- NFR-7. Attachment fetches restricted to a host allowlist (SSRF); per-download
  size cap.
- NFR-8. Tokens from env only; **never logged**; stdout reserved for JSON-RPC.
- NFR-9. Read-only enforced by **not registering** write tools.

### Compatibility & observability
- NFR-10. Node ≥ 18 and Bun; runnable via `bunx`/`npx` and as a single binary.
- NFR-11. Structured error messages as tool errors, not crashes.
- NFR-12. Optional file logging behind an env flag.

---

## 7. Architecture & engineering principles (REQUIRED)

> This section is normative. The project **SHALL** use the modern architecture
> described here. Deviations require an [ADR](adr/).

### 7.1 Architectural style

- **AR-1.** The system **MUST** follow a **layered, ports-and-adapters
  (hexagonal-lite)** architecture with a strict inward **dependency rule**:
  transport → application → domain → infrastructure. Inner layers **MUST NOT**
  import from outer layers.
- **AR-2.** The **transport adapter** (MCP SDK: stdio, later HTTP/SSE) **MUST**
  be isolated so the core is transport-agnostic and reusable by a CLI or HTTP
  service without change.
- **AR-3.** The **domain** (`TrelloClient`) **MUST NOT** depend on the MCP SDK or
  any transport concern.
- **AR-4.** The design **MUST** stay **pragmatic, not maximal**: no DI
  containers, no repository/unit-of-work ceremony, no premature service
  splitting. Every abstraction must earn its place; ease of use and contribution
  are goals of equal weight to modernity.

### 7.2 Cross-cutting principles

- **AR-5. Schema-first, single source of truth.** One schema per tool **MUST**
  produce static types, runtime validation, and the JSON Schema advertised to
  clients. Target library: **TypeBox** (native JSON Schema); Zod is transitional.
- **AR-6. Dependency injection via explicit context.** No global singletons;
  collaborators (client, config, cache, logger) **MUST** be injected, enabling
  unit tests with mocks.
- **AR-7. Typed, non-fatal errors.** User/API failures **MUST** surface as MCP
  tool errors; the process **MUST NOT** crash on them.
- **AR-8. 12-factor configuration.** All config from the environment, validated
  at startup, fail-fast with an actionable message.
- **AR-9. Adapter boundaries around third parties** (MCP SDK, Trello API) to
  contain upstream churn.
- **AR-10. Security by construction** (AR aligns with NFR-7..9).
- **AR-11. Testability first**, including a real attachment-download integration
  test in CI.
- **AR-12. Modern TypeScript + ESM**, `strict` mode, Node ≥ 18 / Bun.
- **AR-13. Documented decisions** via ADRs (`docs/adr/`).

A full description with diagrams lives in
[docs/ARCHITECTURE.md](ARCHITECTURE.md).

---

## 8. Technology stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| **Runtime** | **Bun** (default), Node ≥ 18 compatible | Runs TS directly, fastest cold start, `bun build --compile` for a single binary. See [ADR-0002](adr/0002-runtime-bun-node.md). |
| **Language** | **TypeScript** (strict, ESM) | Keeps the first-party MCP TS SDK; end-to-end types. |
| **MCP SDK** | `@modelcontextprotocol/sdk` | Official, maintained; stdio + resources. |
| **CLI framework** | `commander` | De-facto standard; subcommands, help, tiny footprint. |
| **Schema / validation** | **TypeBox** (from Zod) | Native JSON Schema, one source of truth. [ADR-0003](adr/0003-schema-first-validation.md). |
| **HTTP** | Native `fetch` (undici-class) | No axios; built-in pooling. |
| **Concurrency** | small semaphore / `p-limit` | Bounded parallel downloads (NFR-3). |
| **Rate limiting** | token bucket (in-repo) | 90/10s margin under Trello's limit. |
| **Cache** | TTL LRU | Conserve rate-limit budget (NFR-4). |
| **Testing** | `bun test` (or vitest) | Fast; includes a real download integration test. |
| **Distribution** | `bunx` / `npx` + compiled binaries | Universal install + zero-runtime binary. |

**Why not Go/Rust by default:** absolute-fastest runtimes don't move a
rate-limited I/O proxy in steady state and cost a rewrite plus the loss of the
mature TS MCP SDK. Go remains a documented alternative if single-binary footprint
becomes the top priority.

---

## 9. Documentation & repository standards (public release)

Because the project is public, documentation and repo hygiene are **P0
deliverables**, not afterthoughts.

| ID | Requirement | Priority |
| --- | --- | --- |
| D-1 | `README.md`: badges, TOC, quickstart, examples, config/tool summaries, troubleshooting | P0 |
| D-2 | `docs/ARCHITECTURE.md` with layer diagram and principles | P0 |
| D-3 | `docs/CONFIGURATION.md` (full env reference) | P0 |
| D-4 | `docs/TOOLS.md` (every tool + parameters) | P0 |
| D-5 | `docs/USAGE.md` (setup walkthrough + recipes) | P0 |
| D-6 | `docs/PRD.md` (this document) | P0 |
| D-7 | `docs/adr/` (Architecture Decision Records) | P0 |
| D-8 | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` | P0 |
| D-9 | `LICENSE` (MIT), `CHANGELOG.md` (Keep a Changelog) | P0 |
| D-10 | `.github/`: CI workflow, issue forms, PR template | P0 |
| D-11 | Conventional Commits + SemVer; tagged releases | P1 |
| D-12 | Publish to npm; attach compiled binaries to GitHub Releases | P1 |
| D-13 | Inline code comments on non-obvious logic (e.g. attachment auth) | P0 |

**Docs-match-code rule:** documentation must reflect the shipped code. Where a
choice is mid-migration (e.g. Zod→TypeBox), docs must mark it **planned** and
point to the relevant ADR.

---

## 10. Milestones

| Milestone | Contents | Exit criteria |
| --- | --- | --- |
| **M0 — Foundation (done)** | Core tools + attachment download w/ OAuth auth, resources, read-only/compact; **CLI (17 commands) incl. `archive-board`**; bundled MCP (`trello mcp`) + Skill | Builds & runs; 22 MCP tools + full CLI; downloads verified |
| **M1 — Docs & public readiness (done)** | Full doc set (README, ARCHITECTURE, CLI, TOOLS, USAGE, CONFIGURATION, PRD), ADRs, LICENSE, CONTRIBUTING/CoC/SECURITY, CI, issue/PR templates | Repo is publication-grade; CI green |
| **M2 — Architecture hardening** | Bun default; Zod→TypeBox; TTL cache; bounded-concurrency downloads; download integration test | Cold start < 150 ms; test green in CI |
| **M3 — Coverage** | Labels, members, custom fields (P2), name→id resolution (CLI + MCP); single-binary build | ≥ 90% core surface |
| **M4 — Ship & release** | npm publish, release binaries, docs polish | Installable via npx/bunx/binary; tagged release |
| **M5 — Stretch** | Workspace allowlist; HTTP/SSE transport; webhooks/events | Documented, opt-in |

---

## 11. Risks & mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Trello changes attachment auth again | Downloads break silently | CI integration test that downloads a real uploaded file |
| Rate-limit changes / bursts | 429s, failed calls | Token bucket + backoff + TTL cache; never parallelize past the limit |
| MCP SDK breaking changes | Build/runtime breakage | Pin versions; keep SDK usage behind the transport adapter |
| Token leakage | Security incident | Env-only, never logged, clean stdout, read-only mode |
| Bun install friction for some users | Adoption drop | Maintain npm/npx path + prebuilt binaries |
| Large attachments blow memory | OOM | Size cap; stream very large downloads to disk (P2) |
| Docs drift from code | User confusion, lost trust | Docs-match-code rule (D-13); PR checklist enforces doc updates |

---

## 12. Open questions

- Q1. Default distribution: prebuilt Bun binary or npm/`npx` on Node? (Recommend
  both; binary as the fast path.)
- Q2. Confirm TypeBox migration vs. staying on Zod. (Recommend TypeBox.)
- Q3. CLI scope — archive-only or full parity? (Recommend archive + a few reads.)
- Q4. Multi-account / multi-token support, or single token per instance?
- Q5. Should very large downloads stream to disk rather than buffer? (Likely P2.)

---

## Appendix A — Environment variables

Active: `TRELLO_API_KEY`, `TRELLO_TOKEN` (required); `TRELLO_READ_ONLY`,
`TRELLO_COMPACT`, `TRELLO_DOWNLOAD_DIR`, `TRELLO_DOWNLOAD_IMAGES`,
`TRELLO_MAX_INLINE_IMAGE_BYTES`, `TRELLO_MAX_DOWNLOAD_BYTES`,
`TRELLO_ALLOWED_ATTACHMENT_HOSTS`, `TRELLO_BOARD_ID`. Planned:
`TRELLO_ALLOWED_WORKSPACES`, `TRELLO_DOWNLOAD_CONCURRENCY`, `TRELLO_CACHE_TTL_MS`,
`TRELLO_LOG_FILE`. Full reference: [docs/CONFIGURATION.md](CONFIGURATION.md).

## Appendix B — Tool inventory (v0.1, 22 tools)

Read/download (read-only mode): `list_boards`, `get_board`, `get_lists`,
`get_cards_in_list`, `get_card`, `get_comments`, `get_checklists`, `search`,
`get_card_attachments`, `download_attachment`, `download_all_card_attachments`.

Write: `create_list`, `create_card`, `update_card`, `move_card`, `archive_card`,
`add_comment`, `add_checklist`, `add_checklist_item`, `set_checklist_item_state`,
`attach_url_to_card`, `attach_file_to_card`. Full reference:
[docs/TOOLS.md](TOOLS.md).
