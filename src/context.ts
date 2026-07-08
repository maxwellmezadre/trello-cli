import type { Config } from "./config.js";
import { TtlLruCache } from "./core/cache.js";
import { createTrelloHttp, type HttpDeps } from "./core/http.js";
import { createTrelloClient, type TrelloClient } from "./trello/client.js";

const CACHE_MAX_ENTRIES = 256;

// Contexto de injeção (AR-6): colaboradores passados explicitamente, sem
// singletons globais. Cresce conforme as etapas — cache (019) e logger (020)
// entram aqui quando existirem.
export type Ctx = {
  config: Config;
  trello: TrelloClient;
};

export function createContext(
  config: Config,
  httpDeps?: Partial<HttpDeps>,
): Ctx {
  const http = createTrelloHttp(
    { apiKey: config.apiKey, token: config.token },
    httpDeps,
  );
  const cache = new TtlLruCache<unknown>(config.cacheTtlMs, CACHE_MAX_ENTRIES);
  return { config, trello: createTrelloClient(http, cache) };
}
