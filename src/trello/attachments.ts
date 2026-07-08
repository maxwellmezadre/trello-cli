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
