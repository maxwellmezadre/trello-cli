// Funil único de acesso à API Trello (NFR-2/NFR-5): rate limiting + retry com
// backoff honrando Retry-After. Todo tráfego REST passa por aqui.
//
// Colaboradores temporais (now/sleep/random) e o próprio fetch são injetáveis
// (AR-6) para permitir testes determinísticos com clock e fetch falsos.

/** Subconjunto de `Response` de que precisamos — deixa os mocks simples. */
export type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
};

export type FetchLike = (
  url: string | URL,
  init?: { method?: string },
) => Promise<FetchResponse>;

/** Erro tipado, não-fatal (AR-7). Nunca inclui a URL — ela carrega key/token. */
export class TrelloApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TrelloApiError";
  }
}

/**
 * Limitador de taxa por janela deslizante.
 *
 * ponytail: sliding-window log, não token-bucket clássico. Um token bucket com
 * refill contínuo permitiria um burst inicial + refill rápido que estoura o
 * teto numa janela específica; o limite do Trello (100/10s) é por janela, então
 * registramos os timestamps e garantimos <= capacity em QUALQUER janela.
 */
export class RateLimiter {
  private readonly hits: number[] = [];
  private readonly capacity: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: {
    capacity: number;
    windowMs: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  }) {
    this.capacity = opts.capacity;
    this.windowMs = opts.windowMs;
    this.now = opts.now ?? (() => Date.now());
    this.sleep = opts.sleep ?? realSleep;
  }

  async take(): Promise<void> {
    for (;;) {
      const current = this.now();
      const cutoff = current - this.windowMs;
      while (this.hits.length > 0 && (this.hits[0] as number) <= cutoff) {
        this.hits.shift();
      }
      if (this.hits.length < this.capacity) {
        this.hits.push(current);
        return;
      }
      const oldest = this.hits[0] as number;
      const waitMs = oldest + this.windowMs - current;
      await this.sleep(waitMs > 0 ? waitMs : 0);
    }
  }
}

export type HttpDeps = {
  fetch: FetchLike;
  rateLimiter: RateLimiter;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  baseUrl: string;
};

export type TrelloRequestOptions = {
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
};

export type TrelloHttp = {
  request<T = unknown>(
    path: string,
    options?: TrelloRequestOptions,
  ): Promise<T>;
};

const DEFAULT_BASE_URL = "https://api.trello.com";
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function buildUrl(
  baseUrl: string,
  path: string,
  query: TrelloRequestOptions["query"],
  apiKey: string,
  token: string,
): URL {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  // Auth padrão da API (query params). Anexos uploaded exigem outro esquema
  // (header OAuth) e são tratados fora deste funil — ver etapa 011.
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);
  return url;
}

function retryDelayMs(
  response: FetchResponse,
  attempt: number,
  random: () => number,
): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
  }
  const base = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  return base + Math.floor(random() * base * 0.25);
}

async function parseBody<T>(response: FetchResponse): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}

/**
 * Cria o cliente HTTP da Trello. Precisa apenas de `apiKey`/`token` (não da
 * Config inteira) — mantém a fronteira do adapter enxuta.
 */
export function createTrelloHttp(
  auth: { apiKey: string; token: string },
  deps?: Partial<HttpDeps>,
): TrelloHttp {
  const fetchImpl = deps?.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const rateLimiter =
    deps?.rateLimiter ?? new RateLimiter({ capacity: 90, windowMs: 10_000 });
  const sleep = deps?.sleep ?? realSleep;
  const random = deps?.random ?? Math.random;
  const baseUrl = deps?.baseUrl ?? DEFAULT_BASE_URL;

  async function request<T>(
    path: string,
    options?: TrelloRequestOptions,
  ): Promise<T> {
    const url = buildUrl(baseUrl, path, options?.query, auth.apiKey, auth.token);
    const method = options?.method ?? "GET";

    for (let attempt = 1; ; attempt++) {
      await rateLimiter.take();
      const response = await fetchImpl(url, { method });
      if (response.ok) return parseBody<T>(response);

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < MAX_ATTEMPTS) {
        await sleep(retryDelayMs(response, attempt, random));
        continue;
      }

      // Mensagem sem URL/headers: nunca vaza key/token (NFR-8).
      throw new TrelloApiError(
        response.status,
        `Trello API request failed with HTTP ${response.status} ${response.statusText}`.trimEnd(),
      );
    }
  }

  return { request };
}
