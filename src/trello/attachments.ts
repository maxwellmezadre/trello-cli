import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../config.js";
import type { Ctx } from "../context.js";
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
 * Baixa uma URL de anexo para o disco em stream, com guarda de SSRF (allowlist
 * de host, verificada ANTES do fetch) e teto de tamanho (por Content-Length e
 * durante o stream). Nunca deixa arquivo parcial em caso de falha.
 */
export async function downloadToFile(
  attachment: { url: string; name: string },
  destDir: string,
  config: DownloadConfig,
  deps?: { fetch?: DownloadFetch },
): Promise<{ path: string; bytes: number }> {
  // SSRF: host precisa estar na allowlist — checado ANTES de qualquer fetch.
  const host = hostname(attachment.url);
  if (!config.allowedAttachmentHosts.includes(host)) {
    throw new AttachmentDownloadError(`Host not allowed for download: ${host}`);
  }

  const headers = buildAttachmentAuthHeaders(attachment.url, config);
  const doFetch = deps?.fetch ?? (globalThis.fetch as unknown as DownloadFetch);
  const response = await doFetch(attachment.url, { headers });
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

  await mkdir(destDir, { recursive: true });
  const filePath = join(destDir, sanitizeFilename(attachment.name));
  const handle = await open(filePath, "w");
  const reader = response.body.getReader();
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
