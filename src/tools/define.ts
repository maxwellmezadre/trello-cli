import type { Static, TObject } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { Ctx } from "../context.js";

// AR-5: um schema TypeBox por tool é a fonte única de verdade — dele saem os
// tipos estáticos (Static<S>), a validação em runtime (Value.Check) e o JSON
// Schema anunciado ao cliente MCP (o próprio objeto `input`).
export type ToolDef<S extends TObject = TObject> = {
  name: string;
  description: string;
  /** read-only mode filtra por esta flag ANTES de registrar (NFR-9). */
  readOnly: boolean;
  input: S;
  run: (args: Static<S>, ctx: Ctx) => Promise<unknown>;
};

/**
 * Registra uma tool. Apaga o parâmetro genérico na fronteira para que tools de
 * schemas distintos convivam num mesmo `ToolDef[]` — o `run` continua tipado
 * pelo schema dentro da definição.
 */
export function defineTool<S extends TObject>(tool: ToolDef<S>): ToolDef {
  return tool as unknown as ToolDef;
}

/** Erro estruturado de validação de argumentos — vira tool error, não crash. */
export class ToolInputError extends Error {
  constructor(
    public readonly tool: string,
    public readonly problems: string[],
  ) {
    super(
      `Invalid arguments for ${tool}:\n${problems
        .map((problem) => `  - ${problem}`)
        .join("\n")}`,
    );
    this.name = "ToolInputError";
  }
}

/**
 * Valida `rawArgs` contra o schema da tool e executa. Input inválido lança
 * {@link ToolInputError} (estruturado) em vez de deixar uma exceção crua vazar.
 */
export async function runTool(
  tool: ToolDef,
  rawArgs: unknown,
  ctx: Ctx,
): Promise<unknown> {
  if (!Value.Check(tool.input, rawArgs)) {
    const problems = [...Value.Errors(tool.input, rawArgs)].map(
      (error) => `${error.path || "/"}: ${error.message}`,
    );
    throw new ToolInputError(tool.name, problems);
  }
  return tool.run(rawArgs, ctx);
}
