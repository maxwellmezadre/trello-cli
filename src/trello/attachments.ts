import { mkdir, open, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../config.js";
import type { Ctx } from "../context.js";
import { TrelloApiError } from "../core/http.js";
import type { Attachment } from "./client.js";

// Hosts em que um anexo é servido pela Trello como UPLOAD. É o host — não o
// campo `isUpload` da API — que decide o esquema de autenticação do download
// (etapa 011): uploads exigem o header OAuth; links externos não recebem
// credencial alguma. Manter esta classificação correta é o diferencial do
// produto, por isso ela é isolada e testada aqui.
//
// ponytail: conjunto fixo dos hosts conhecidos. Se a Trello passar a servir
// uploads de outro host, o teste de integração real (etapa 026) revela e a
// lista se ajusta aqui, num único ponto.
export const TRELLO_UPLOAD_HOSTS: readonly string[] = [
  "trello.com",
  "api.trello.com",
  "trello-attachments.s3.amazonaws.com",
];

export function isUploadedAttachment(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return TRELLO_UPLOAD_HOSTS.includes(hostname);
}

export type EnrichedAttachment = Attachment & {
  /** true = servido pela Trello como upload (precisa do header OAuth). */
  isUpload: boolean;
  /** URI de resource MCP legível (etapa 013). */
  uri: string;
};

export function enrichAttachment(
  cardId: string,
  attachment: Attachment,
): EnrichedAttachment {
  return {
    ...attachment,
    isUpload: isUploadedAttachment(attachment.url),
    uri: `trello://cards/${cardId}/attachments/${attachment.id}`,
  };
}

// ── Download ──────────────────────────────────────────────────────────────

export class AttachmentDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentDownloadError";
  }
}

/** Subconjunto de `Response` para downloads (corpo em stream, não JSON). */
export type DownloadResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
};

export type DownloadFetch = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<DownloadResponse>;

type DownloadConfig = Pick<
  Config,
  "apiKey" | "token" | "allowedAttachmentHosts" | "maxDownloadBytes"
>;

/**
 * Monta os headers de autenticação do download.
 *
 * DETALHE CRÍTICO (D-13): anexos uploaded na Trello (hosts trello.com /
 * amazonaws) SÓ baixam com o header `Authorization: OAuth ...`. Passar
 * key/token como query params — que funciona para o resto da API — retorna
 * uma página de login HTML ou 401 nessas URLs. Por isso o header vai por aqui,
 * e SOMENTE para hosts de upload da Trello: mandá-lo a um host externo
 * vazaria o token do usuário.
 */
export function buildAttachmentAuthHeaders(
  url: string,
  auth: { apiKey: string; token: string },
): Record<string, string> {
  if (!isUploadedAttachment(url)) return {};
  return {
    Authorization: `OAuth oauth_consumer_key="${auth.apiKey}", oauth_token="${auth.token}"`,
  };
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    throw new AttachmentDownloadError(`Invalid attachment URL`);
  }
}

/** Nome de arquivo seguro — só o basename, sem path traversal. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").trim();
  return cleaned && cleaned !== "." && cleaned !== ".."
    ? cleaned
    : "attachment";
}

/**
 * Aplica as guardas de segurança e abre o stream do anexo: allowlist de host
 * (SSRF, ANTES do fetch), header OAuth quando upload, e teto por
 * Content-Length. Retorna o reader do corpo + o cap para checagem em stream.
 * Consumido por {@link downloadToFile} (disco) e {@link readAttachmentBytes}
 * (memória) — a lógica sensível fica num único ponto.
 */
async function openAttachment(
  url: string,
  config: DownloadConfig,
  deps?: { fetch?: DownloadFetch },
) {
  // SSRF: host precisa estar na allowlist — checado ANTES de qualquer fetch.
  const host = hostname(url);
  if (!config.allowedAttachmentHosts.includes(host)) {
    throw new AttachmentDownloadError(`Host not allowed for download: ${host}`);
  }

  const headers = buildAttachmentAuthHeaders(url, config);
  const doFetch = deps?.fetch ?? (globalThis.fetch as unknown as DownloadFetch);
  const response = await doFetch(url, { headers });
  if (!response.ok) {
    throw new AttachmentDownloadError(
      `Download failed with HTTP ${response.status}`,
    );
  }

  const cap = config.maxDownloadBytes;
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > cap) {
    throw new AttachmentDownloadError(
      `Attachment exceeds size cap: ${declared} > ${cap} bytes`,
    );
  }
  if (!response.body) {
    throw new AttachmentDownloadError("Attachment response has no body");
  }

  return {
    reader: response.body.getReader(),
    cap,
    contentType: response.headers.get("content-type"),
  };
}

/**
 * Baixa uma URL de anexo para o disco em stream, com guarda de SSRF e teto de
 * tamanho (por Content-Length e durante o stream). Nunca deixa arquivo parcial.
 */
export async function downloadToFile(
  attachment: { url: string; name: string },
  destDir: string,
  config: DownloadConfig,
  deps?: { fetch?: DownloadFetch },
): Promise<{ path: string; bytes: number }> {
  const { reader, cap } = await openAttachment(attachment.url, config, deps);

  await mkdir(destDir, { recursive: true });
  const filePath = join(destDir, sanitizeFilename(attachment.name));
  const handle = await open(filePath, "w");
  let written = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      written += value.byteLength;
      if (written > cap) {
        throw new AttachmentDownloadError(
          `Attachment exceeds size cap: > ${cap} bytes`,
        );
      }
      await handle.write(value);
    }
  } catch (error) {
    await handle.close();
    await rm(filePath, { force: true }); // não deixa arquivo parcial
    throw error;
  }
  await handle.close();
  return { path: filePath, bytes: written };
}

/**
 * Baixa um anexo para a memória (mesmas guardas do {@link downloadToFile}).
 * Usado por resources MCP e imagens inline — payloads pequenos, com cap.
 */
export async function readAttachmentBytes(
  attachment: { url: string },
  config: DownloadConfig,
  deps?: { fetch?: DownloadFetch },
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const { reader, cap, contentType } = await openAttachment(
    attachment.url,
    config,
    deps,
  );
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > cap) {
      throw new AttachmentDownloadError(
        `Attachment exceeds size cap: > ${cap} bytes`,
      );
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, contentType };
}

/**
 * Resolve o anexo por id no card e o baixa para o disco. Retorna metadados do
 * arquivo gravado.
 */
export async function downloadCardAttachment(
  ctx: Ctx,
  params: { cardId: string; attachmentId: string; destDir?: string },
  deps?: { fetch?: DownloadFetch },
): Promise<{ path: string; bytes: number; name: string; isUpload: boolean }> {
  const attachments = await ctx.trello.getCardAttachments(params.cardId);
  const attachment = attachments.find(
    (candidate) => candidate.id === params.attachmentId,
  );
  if (!attachment) {
    throw new AttachmentDownloadError(
      `Attachment ${params.attachmentId} not found on card ${params.cardId}`,
    );
  }

  const destDir = params.destDir ?? ctx.config.downloadDir;
  const written = await downloadToFile(attachment, destDir, ctx.config, deps);
  return {
    path: written.path,
    bytes: written.bytes,
    name: attachment.name,
    isUpload: isUploadedAttachment(attachment.url),
  };
}

// ── Bulk download ─────────────────────────────────────────────────────────

export type DownloadManifest = {
  ok: Array<{ id: string; name: string; path: string; bytes: number }>;
  failed: Array<{ id: string; name: string; error: string }>;
  summary: { total: number; ok: number; failed: number };
};

/**
 * Executa `worker` sobre cada item com no máximo `limit` em paralelo,
 * preservando a ordem. Semáforo in-repo — evita uma dependência.
 *
 * ponytail: `limit` runners puxando de um índice compartilhado; troca por
 * p-limit se precisar de features (cancelamento, prioridade).
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runnerCount = Math.min(Math.max(1, limit), items.length);
  const runners = Array.from({ length: runnerCount }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index] as T, index);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Baixa todos os anexos de um card com concorrência limitada (NFR-3) e
 * tolerância a falhas (NFR-6): uma falha não interrompe as demais e é
 * registrada em `_manifest.json`.
 */
export async function downloadAllCardAttachments(
  ctx: Ctx,
  params: { cardId: string; destDir?: string; concurrency?: number },
  deps?: { fetch?: DownloadFetch },
): Promise<DownloadManifest> {
  const attachments = await ctx.trello.getCardAttachments(params.cardId);
  const destDir = params.destDir ?? join(ctx.config.downloadDir, params.cardId);
  const limit = Math.max(
    1,
    params.concurrency ?? ctx.config.downloadConcurrency,
  );
  await mkdir(destDir, { recursive: true });

  const ok: DownloadManifest["ok"] = [];
  const failed: DownloadManifest["failed"] = [];

  const entries = await mapWithConcurrency(attachments, limit, async (att) => {
    try {
      const written = await downloadToFile(att, destDir, ctx.config, deps);
      return {
        kind: "ok" as const,
        id: att.id,
        name: att.name,
        path: written.path,
        bytes: written.bytes,
      };
    } catch (error) {
      return {
        kind: "failed" as const,
        id: att.id,
        name: att.name,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  for (const entry of entries) {
    if (entry.kind === "ok") {
      ok.push({
        id: entry.id,
        name: entry.name,
        path: entry.path,
        bytes: entry.bytes,
      });
    } else {
      failed.push({ id: entry.id, name: entry.name, error: entry.error });
    }
  }

  const manifest: DownloadManifest = {
    ok,
    failed,
    summary: { total: attachments.length, ok: ok.length, failed: failed.length },
  };
  await writeFile(
    join(destDir, "_manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  return manifest;
}

// ── Delete ────────────────────────────────────────────────────────────────

/**
 * DELETE de um anexo já resolvido na listagem. O 404 aqui só acontece na
 * corrida entre a listagem e o DELETE — a checagem de existência é de quem
 * chama.
 *
 * ponytail: Error puro em vez de uma classe nova — CLI e MCP só leem
 * `.message`, e `pickByName` já usa Error puro no not-found análogo. Vira
 * classe quando alguém precisar discriminar o tipo.
 */
async function deleteOne(
  ctx: Ctx,
  cardId: string,
  attachment: Attachment,
): Promise<void> {
  try {
    await ctx.trello.deleteCardAttachment(cardId, attachment.id);
  } catch (error) {
    // Só IDs e nome na mensagem: a da camada HTTP omite a URL de propósito,
    // que carrega key/token (NFR-8).
    if (error instanceof TrelloApiError && error.status === 404) {
      throw new Error(
        `Attachment ${attachment.id} ("${attachment.name}") no longer exists on card ${cardId}`,
      );
    }
    throw error;
  }
}

/**
 * Remove um anexo de um card. Irreversível: a Trello não arquiva anexo, só
 * apaga.
 *
 * Resolve o anexo na listagem ANTES do DELETE, como
 * {@link downloadCardAttachment}. A API não documenta resposta de erro para
 * este endpoint: nem 404 (anexo inexistente) nem 400 (id malformado, o caso do
 * id curto colado da URL do card) são garantidos. Checar antes é o único jeito
 * de dar "não encontrado" de forma confiável — e de nunca disparar um DELETE
 * contra um alvo não verificado. Custa um GET (anexos não entram no cache).
 */
export async function deleteCardAttachment(
  ctx: Ctx,
  params: { cardId: string; attachmentId: string },
): Promise<{
  deleted: true;
  cardId: string;
  attachmentId: string;
  name: string;
}> {
  const attachments = await ctx.trello.getCardAttachments(params.cardId);
  const attachment = attachments.find(
    (candidate) => candidate.id === params.attachmentId,
  );
  if (!attachment) {
    throw new Error(
      `Attachment ${params.attachmentId} not found on card ${params.cardId}`,
    );
  }

  await deleteOne(ctx, params.cardId, attachment);
  return {
    deleted: true,
    cardId: params.cardId,
    attachmentId: attachment.id,
    name: attachment.name,
  };
}

export type DeleteReport = {
  ok: Array<{ id: string; name: string }>;
  failed: Array<{ id: string; name: string; error: string }>;
  summary: { total: number; ok: number; failed: number };
};

/**
 * Remove TODOS os anexos de um card, com concorrência limitada (NFR-3) e
 * tolerância a falha por item (NFR-6) — espelha o bulk download. Card sem
 * anexos devolve o relatório zerado sem chamar a API.
 */
export async function deleteAllCardAttachments(
  ctx: Ctx,
  params: { cardId: string; concurrency?: number },
): Promise<DeleteReport> {
  const attachments = await ctx.trello.getCardAttachments(params.cardId);
  const limit = Math.max(
    1,
    params.concurrency ?? ctx.config.downloadConcurrency,
  );

  const entries = await mapWithConcurrency(attachments, limit, async (att) => {
    try {
      await deleteOne(ctx, params.cardId, att);
      return { kind: "ok" as const, id: att.id, name: att.name };
    } catch (error) {
      // Um 404 aqui (alguém apagou no meio) conta como falha, não sucesso: a
      // pós-condição vale, mas o relatório prefere ser literal.
      return {
        kind: "failed" as const,
        id: att.id,
        name: att.name,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const ok: DeleteReport["ok"] = [];
  const failed: DeleteReport["failed"] = [];
  for (const entry of entries) {
    if (entry.kind === "ok") {
      ok.push({ id: entry.id, name: entry.name });
    } else {
      failed.push({ id: entry.id, name: entry.name, error: entry.error });
    }
  }

  return {
    ok,
    failed,
    summary: {
      total: attachments.length,
      ok: ok.length,
      failed: failed.length,
    },
  };
}

// ── MCP resources & imagens inline ────────────────────────────────────────

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Lê um anexo para servir como resource MCP: bytes em base64 + mimeType.
 * Reusa o pipeline com guardas (auth/allowlist/cap) de {@link readAttachmentBytes}.
 */
export async function readCardAttachmentResource(
  ctx: Ctx,
  cardId: string,
  attachmentId: string,
  deps?: { fetch?: DownloadFetch },
): Promise<{ mimeType: string; base64: string; name: string }> {
  const attachments = await ctx.trello.getCardAttachments(cardId);
  const attachment = attachments.find(
    (candidate) => candidate.id === attachmentId,
  );
  if (!attachment) {
    throw new AttachmentDownloadError(
      `Attachment ${attachmentId} not found on card ${cardId}`,
    );
  }

  const { bytes, contentType } = await readAttachmentBytes(
    attachment,
    ctx.config,
    deps,
  );
  return {
    mimeType: contentType ?? attachment.mimeType ?? "application/octet-stream",
    base64: Buffer.from(bytes).toString("base64"),
    name: attachment.name,
  };
}

export type InlineImage = { mimeType: string; base64: string };

/**
 * Coleta imagens pequenas de um card para inline no `get_card` (MCP).
 * Gate (F-15): só quando `downloadImages` está ligado, e apenas anexos que
 * sejam uploads, de host permitido, com mimeType de imagem e tamanho (por
 * metadado) dentro de `maxInlineImageBytes`. Retorna `[]` se o gate barrar
 * tudo — sem baixar nada.
 */
export async function collectInlineImages(
  ctx: Ctx,
  cardId: string,
  deps?: { fetch?: DownloadFetch },
): Promise<InlineImage[]> {
  const config = ctx.config;
  if (!config.downloadImages) return [];

  const attachments = await ctx.trello.getCardAttachments(cardId);
  const candidates = attachments.filter(
    (attachment) =>
      isUploadedAttachment(attachment.url) &&
      config.allowedAttachmentHosts.includes(safeHostname(attachment.url)) &&
      (attachment.mimeType?.startsWith("image/") ?? false) &&
      attachment.bytes !== null &&
      attachment.bytes <= config.maxInlineImageBytes,
  );

  const images: InlineImage[] = [];
  for (const candidate of candidates) {
    const { bytes, contentType } = await readAttachmentBytes(
      candidate,
      config,
      deps,
    );
    // Guarda extra: o tamanho real também respeita o cap.
    if (bytes.byteLength > config.maxInlineImageBytes) continue;
    images.push({
      mimeType: contentType ?? candidate.mimeType ?? "image/png",
      base64: Buffer.from(bytes).toString("base64"),
    });
  }
  return images;
}
