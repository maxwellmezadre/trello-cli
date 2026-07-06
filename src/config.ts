import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

// AR-5/AR-8: TypeBox é a fonte única de verdade da config. O schema descreve o
// objeto JÁ parseado (booleans/números/listas), não as strings cruas do ambiente.
// Todo valor vem do ambiente (12-factor); não lemos arquivos `.env`.
export const ConfigSchema = Type.Object({
  apiKey: Type.String({ minLength: 1 }),
  token: Type.String({ minLength: 1 }),
  readOnly: Type.Boolean(),
  compact: Type.Boolean(),
  downloadDir: Type.String({ minLength: 1 }),
  downloadImages: Type.Boolean(),
  maxInlineImageBytes: Type.Integer({ minimum: 0 }),
  maxDownloadBytes: Type.Integer({ minimum: 0 }),
  allowedAttachmentHosts: Type.Array(Type.String({ minLength: 1 })),
  boardId: Type.Optional(Type.String({ minLength: 1 })),
  downloadConcurrency: Type.Integer({ minimum: 1 }),
  cacheTtlMs: Type.Integer({ minimum: 0 }),
  logFile: Type.Optional(Type.String({ minLength: 1 })),
});

export type Config = Static<typeof ConfigSchema>;

const DEFAULT_ALLOWED_HOSTS =
  "trello.com,api.trello.com,trello-attachments.s3.amazonaws.com";
const APP_KEY_URL = "https://trello.com/app-key";

/**
 * Erro de configuração fail-fast. Agrega todos os problemas para que o usuário
 * conserte tudo de uma vez, em vez de descobrir um por vez.
 */
export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Invalid Trello configuration:\n${problems
        .map((problem) => `  - ${problem}`)
        .join("\n")}`,
    );
    this.name = "ConfigError";
  }
}

type Env = Record<string, string | undefined>;

function readBool(
  problems: string[],
  env: Env,
  key: string,
  fallback: boolean,
): boolean {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "yes" || value === "on") {
    return true;
  }
  if (value === "0" || value === "false" || value === "no" || value === "off") {
    return false;
  }
  problems.push(
    `${key} must be a boolean (1/0, true/false, yes/no, on/off), got "${raw}"`,
  );
  return fallback;
}

function readInt(
  problems: string[],
  env: Env,
  key: string,
  fallback: number,
  { min }: { min: number },
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min) {
    problems.push(
      `${key} must be an integer >= ${min}, got "${raw}"`,
    );
    return fallback;
  }
  return parsed;
}

function readHosts(env: Env, key: string, fallback: string): string[] {
  const raw = env[key];
  const source = raw === undefined || raw.trim() === "" ? fallback : raw;
  return source
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
}

function readOptional(env: Env, key: string): string | undefined {
  const raw = env[key]?.trim();
  return raw ? raw : undefined;
}

/**
 * Carrega e valida a config a partir do ambiente. Lança {@link ConfigError} com
 * uma mensagem acionável se algo faltar ou for inválido (AR-8, fail-fast).
 */
export function loadConfig(env: Env = process.env): Config {
  const problems: string[] = [];

  const apiKey = env.TRELLO_API_KEY?.trim();
  if (!apiKey) {
    problems.push(`TRELLO_API_KEY is required — get one at ${APP_KEY_URL}`);
  }
  const token = env.TRELLO_TOKEN?.trim();
  if (!token) {
    problems.push(
      `TRELLO_TOKEN is required — generate a token from your API key at ${APP_KEY_URL}`,
    );
  }

  const candidate = {
    apiKey: apiKey ?? "",
    token: token ?? "",
    readOnly: readBool(problems, env, "TRELLO_READ_ONLY", false),
    compact: readBool(problems, env, "TRELLO_COMPACT", false),
    downloadDir: readOptional(env, "TRELLO_DOWNLOAD_DIR") ?? "./trello-downloads",
    downloadImages: readBool(problems, env, "TRELLO_DOWNLOAD_IMAGES", false),
    maxInlineImageBytes: readInt(
      problems,
      env,
      "TRELLO_MAX_INLINE_IMAGE_BYTES",
      256 * 1024,
      { min: 0 },
    ),
    maxDownloadBytes: readInt(
      problems,
      env,
      "TRELLO_MAX_DOWNLOAD_BYTES",
      50 * 1024 * 1024,
      { min: 0 },
    ),
    allowedAttachmentHosts: readHosts(
      env,
      "TRELLO_ALLOWED_ATTACHMENT_HOSTS",
      DEFAULT_ALLOWED_HOSTS,
    ),
    boardId: readOptional(env, "TRELLO_BOARD_ID"),
    downloadConcurrency: readInt(
      problems,
      env,
      "TRELLO_DOWNLOAD_CONCURRENCY",
      4,
      { min: 1 },
    ),
    cacheTtlMs: readInt(problems, env, "TRELLO_CACHE_TTL_MS", 30_000, {
      min: 0,
    }),
    logFile: readOptional(env, "TRELLO_LOG_FILE"),
  } satisfies Config;

  if (problems.length > 0) throw new ConfigError(problems);

  // Rede de segurança: garante que o objeto parseado casa o schema TypeBox
  // (pega qualquer divergência de parsing que os checks acima não cobriram).
  if (!Value.Check(ConfigSchema, candidate)) {
    const schemaProblems = [...Value.Errors(ConfigSchema, candidate)].map(
      (error) => `${error.path || "/"}: ${error.message}`,
    );
    throw new ConfigError(schemaProblems);
  }

  return candidate;
}
