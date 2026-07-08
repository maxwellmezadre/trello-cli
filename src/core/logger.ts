import { appendFileSync } from "node:fs";

// Logger de diagnóstico (NFR-8/NFR-12): SEMPRE em stderr — stdout fica
// reservado ao JSON-RPC do MCP. Arquivo opcional via TRELLO_LOG_FILE. Tokens
// nunca são logados: toda mensagem passa por redação.

export type LogLevel = "debug" | "info" | "warn" | "error";
export type Logger = Record<LogLevel, (message: string) => void>;

export function redactSecrets(
  message: string,
  secrets: readonly string[],
): string {
  let output = message;
  for (const secret of secrets) {
    if (secret) output = output.split(secret).join("***");
  }
  return output;
}

export function createLogger(opts: {
  logFile?: string;
  secrets?: readonly string[];
}): Logger {
  const secrets = opts.secrets ?? [];
  const emit = (level: LogLevel, message: string) => {
    const line = `[${level}] ${redactSecrets(message, secrets)}\n`;
    process.stderr.write(line);
    if (opts.logFile) {
      try {
        appendFileSync(opts.logFile, line);
      } catch {
        // Logging nunca deve derrubar o processo.
      }
    }
  };
  return {
    debug: (message) => emit("debug", message),
    info: (message) => emit("info", message),
    warn: (message) => emit("warn", message),
    error: (message) => emit("error", message),
  };
}
