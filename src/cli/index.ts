import { Command } from "commander";
import { loadConfig } from "../config.js";
import { createContext } from "../context.js";
import { runTool } from "../tools/define.js";
import { activeTools, allTools } from "../tools/registry.js";

// CLI sobre o MESMO registry/domínio do MCP (F-24): cada comando monta os args
// e chama `runTool` — validação e comportamento idênticos aos da tool MCP.

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
    const config = loadConfig();
    const ctx = createContext(config);
    // Resolve pela mesma lista do MCP: em read-only as write tools não são
    // registradas, então comandos de escrita falham aqui (NFR-9).
    const tool = activeTools(config).find(
      (candidate) => candidate.name === toolName,
    );
    if (!tool) {
      const exists = allTools.some((candidate) => candidate.name === toolName);
      throw new Error(
        exists
          ? `Command unavailable in read-only mode: ${toolName}`
          : `Tool not found: ${toolName}`,
      );
    }
    const result = await runTool(tool, args, ctx);
    // stdout só o resultado; erros vão para stderr.
    console.log(json ? JSON.stringify(result, null, 2) : formatHuman(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function toNumber(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
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

  // ── Escrita ──────────────────────────────────────────────────────────────

  command("create-list <boardId> <name>")
    .description("Cria uma lista")
    .action((boardId, name, options) =>
      invoke("create_list", { boardId, name }, options.json ?? false),
    );

  command("create-card <listId> <name>")
    .description("Cria um card")
    .option("--desc <desc>", "descrição")
    .option("--due <due>", "vencimento (ISO 8601)")
    .option("--pos <pos>", "posição (número, top ou bottom)")
    .action((listId, name, options) =>
      invoke(
        "create_card",
        { listId, name, desc: options.desc, due: options.due, pos: options.pos },
        options.json ?? false,
      ),
    );

  command("update-card <cardId>")
    .description("Atualiza um card")
    .option("--name <name>", "novo nome")
    .option("--desc <desc>", "nova descrição")
    .option("--due <due>", "vencimento (ISO 8601)")
    .option("--due-complete", "marca o vencimento como concluído")
    .action((cardId, options) =>
      invoke(
        "update_card",
        {
          cardId,
          name: options.name,
          desc: options.desc,
          due: options.due,
          dueComplete: options.dueComplete,
        },
        options.json ?? false,
      ),
    );

  command("move-card <cardId> <listId>")
    .description("Move um card para outra lista")
    .option("--pos <pos>", "posição (número, top ou bottom)")
    .action((cardId, listId, options) =>
      invoke(
        "move_card",
        { cardId, listId, pos: options.pos },
        options.json ?? false,
      ),
    );

  command("archive-card <cardId>")
    .description("Arquiva um card")
    .action((cardId, options) =>
      invoke("archive_card", { cardId }, options.json ?? false),
    );

  command("comment <cardId> <text>")
    .description("Adiciona um comentário")
    .action((cardId, text, options) =>
      invoke("add_comment", { cardId, text }, options.json ?? false),
    );

  command("add-checklist <cardId> <name>")
    .description("Adiciona um checklist")
    .action((cardId, name, options) =>
      invoke("add_checklist", { cardId, name }, options.json ?? false),
    );

  command("add-checklist-item <checklistId> <name>")
    .description("Adiciona um item a um checklist")
    .option("--checked", "cria o item já marcado")
    .action((checklistId, name, options) =>
      invoke(
        "add_checklist_item",
        { checklistId, name, checked: options.checked },
        options.json ?? false,
      ),
    );

  command("set-item-state <cardId> <checkItemId> <state>")
    .description("Marca/desmarca um item (complete|incomplete)")
    .action((cardId, checkItemId, state, options) =>
      invoke(
        "set_checklist_item_state",
        { cardId, checkItemId, state },
        options.json ?? false,
      ),
    );

  command("attach-url <cardId> <url>")
    .description("Anexa uma URL a um card")
    .action((cardId, url, options) =>
      invoke("attach_url_to_card", { cardId, url }, options.json ?? false),
    );

  command("attach-file <cardId> <filePath>")
    .description("Faz upload de um arquivo local")
    .option("--name <name>", "nome do anexo")
    .action((cardId, filePath, options) =>
      invoke(
        "attach_file_to_card",
        { cardId, filePath, name: options.name },
        options.json ?? false,
      ),
    );

  // ── Download (disponível também em read-only) ─────────────────────────────

  command("download <cardId> <attachmentId>")
    .description("Baixa um anexo para o disco")
    .option("--dest <dir>", "diretório de destino")
    .action((cardId, attachmentId, options) =>
      invoke(
        "download_attachment",
        { cardId, attachmentId, destDir: options.dest },
        options.json ?? false,
      ),
    );

  command("download-all <cardId>")
    .description("Baixa todos os anexos de um card")
    .option("--dest <dir>", "diretório de destino")
    .option("--concurrency <n>", "downloads simultâneos")
    .action((cardId, options) =>
      invoke(
        "download_all_card_attachments",
        {
          cardId,
          destDir: options.dest,
          concurrency: toNumber(options.concurrency),
        },
        options.json ?? false,
      ),
    );

  // ── Labels, members, custom fields ────────────────────────────────────────

  command("labels <boardId>")
    .description("Lista as labels de um board")
    .action((boardId, options) =>
      invoke("get_board_labels", { boardId }, options.json ?? false),
    );

  command("create-label <boardId> <name>")
    .description("Cria uma label")
    .option("--color <color>", "cor (ex. green, red)")
    .action((boardId, name, options) =>
      invoke(
        "create_label",
        { boardId, name, color: options.color },
        options.json ?? false,
      ),
    );

  command("add-label <cardId> <labelId>")
    .description("Atribui uma label a um card")
    .action((cardId, labelId, options) =>
      invoke("add_label_to_card", { cardId, labelId }, options.json ?? false),
    );

  command("members <boardId>")
    .description("Lista os membros de um board")
    .action((boardId, options) =>
      invoke("get_board_members", { boardId }, options.json ?? false),
    );

  command("assign-member <cardId> <memberId>")
    .description("Atribui um membro a um card")
    .action((cardId, memberId, options) =>
      invoke(
        "assign_member_to_card",
        { cardId, memberId },
        options.json ?? false,
      ),
    );

  command("custom-fields <boardId>")
    .description("Lista as definições de custom fields de um board")
    .action((boardId, options) =>
      invoke("get_custom_fields", { boardId }, options.json ?? false),
    );

  command("card-custom-fields <cardId>")
    .description("Lê os valores de custom fields de um card")
    .action((cardId, options) =>
      invoke("get_card_custom_fields", { cardId }, options.json ?? false),
    );

  command("set-custom-field <cardId> <customFieldId> <value>")
    .description("Define um custom field (--type text|number|checked|date|list)")
    .option("--type <type>", "tipo do campo", "text")
    .action((cardId, customFieldId, value, options) =>
      invoke(
        "set_card_custom_field",
        { cardId, customFieldId, value, type: options.type },
        options.json ?? false,
      ),
    );

  // Orquestração CLI-only (não é uma tool MCP): exporta o board inteiro.
  command("archive-board <boardId>")
    .description("Exporta um board inteiro (cards + anexos) para disco")
    .option("--out <dir>", "diretório de saída", "./trello-export")
    .action(async (boardId, options) => {
      try {
        const ctx = createContext(loadConfig());
        const { archiveBoard } = await import("./archive.js");
        const summary = await archiveBoard(ctx, boardId, options.out);
        console.log(
          options.json
            ? JSON.stringify(summary, null, 2)
            : `Exported ${summary.cards} cards to ${summary.outDir} (${summary.failedAttachments} attachment failures)`,
        );
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });

  await program.parseAsync(argv);
}
