import type { Config } from "./config.js";
import { TtlLruCache } from "./core/cache.js";
import { createTrelloHttp, type HttpDeps } from "./core/http.js";
import { createLogger, type Logger } from "./core/logger.js";
import { createTrelloClient, type TrelloClient } from "./trello/client.js";

const CACHE_MAX_ENTRIES = 256;

// Contexto de injeção (AR-6): colaboradores passados explicitamente, sem
// singletons globais.
export type Ctx = {
  config: Config;
  trello: TrelloClient;
  log: Logger;
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
  const log = createLogger({
    logFile: config.logFile,
    secrets: [config.apiKey, config.token],
  });
  return { config, trello: createTrelloClient(http, cache), log };
}
