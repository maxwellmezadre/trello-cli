import { Command } from "commander";
import { loadConfig } from "../config.js";
import { createContext } from "../context.js";
import { runTool } from "../tools/define.js";
import { allTools } from "../tools/registry.js";

// CLI sobre o MESMO registry/domínio do MCP (F-24): cada comando monta os args
// e chama `runTool` — validação e comportamento idênticos aos da tool MCP.

function toolByName(name: string) {
  const tool = allTools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

function formatLine(item: unknown): string {
  if (item && typeof item === "object" && "id" in item) {
    const record = item as Record<string, unknown>;
    const label = record.name ?? record.text ?? "";
    return `${String(record.id)}\t${String(label)}`;
  }
  return JSON.stringify(item);
}

function formatHuman(result: unknown): string {
  if (Array.isArray(result)) return result.map(formatLine).join("\n");
  return formatLine(result);
}

async function invoke(
  toolName: string,
  args: Record<string, unknown>,
  json: boolean,
): Promise<void> {
  try {
    const ctx = createContext(loadConfig());
    const result = await runTool(toolByName(toolName), args, ctx);
    // stdout só o resultado; erros vão para stderr.
    console.log(json ? JSON.stringify(result, null, 2) : formatHuman(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export async function runCli(argv: string[], version: string): Promise<void> {
  const program = new Command();
  program
    .name("trello")
    .description("Trello CLI — leitura, escrita e anexos")
    .version(version);

  // Cada comando ganha --json para saída estruturada.
  const command = (signature: string) =>
    program.command(signature).option("--json", "saída em JSON puro");

  command("boards")
    .description("Lista os boards")
    .action((options) => invoke("list_boards", {}, options.json ?? false));

  command("board <id>")
    .description("Detalhes de um board")
    .option("--with-lists", "inclui as listas abertas")
    .action((id, options) =>
      invoke(
        "get_board",
        { boardId: id, withLists: options.withLists },
        options.json ?? false,
      ),
    );

  command("lists <boardId>")
    .description("Lista as listas de um board")
    .action((boardId, options) =>
      invoke("get_lists", { boardId }, options.json ?? false),
    );

  command("cards <listId>")
    .description("Lista os cards de uma lista")
    .action((listId, options) =>
      invoke("get_cards_in_list", { listId }, options.json ?? false),
    );

  command("card <id>")
    .description("Detalhes de um card")
    .action((id, options) =>
      invoke("get_card", { cardId: id }, options.json ?? false),
    );

  command("comments <cardId>")
    .description("Comentários de um card")
    .action((cardId, options) =>
      invoke("get_comments", { cardId }, options.json ?? false),
    );

  command("checklists <cardId>")
    .description("Checklists de um card")
    .action((cardId, options) =>
      invoke("get_checklists", { cardId }, options.json ?? false),
    );

  command("search <query>")
    .description("Busca universal")
    .action((query, options) =>
      invoke("search", { query }, options.json ?? false),
    );

  command("attachments <cardId>")
    .description("Lista os anexos de um card")
    .action((cardId, options) =>
      invoke("get_card_attachments", { cardId }, options.json ?? false),
    );

  await program.parseAsync(argv);
}
