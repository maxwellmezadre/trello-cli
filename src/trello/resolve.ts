// Resolução nome→id (F-19). IDs do Trello são 24 chars hex; qualquer outra
// coisa é tratada como nome e resolvida por match exato (case-insensitive).
// Ambiguidade nunca é resolvida silenciosamente — erra listando os candidatos,
// para não operar no objeto errado.

export function isTrelloId(value: string): boolean {
  return /^[0-9a-f]{24}$/i.test(value);
}

export function pickByName<T extends { id: string; name: string }>(
  items: readonly T[],
  name: string,
  kind: string,
): string {
  const wanted = name.toLowerCase();
  const matches = items.filter((item) => item.name.toLowerCase() === wanted);
  if (matches.length === 1) return (matches[0] as T).id;
  if (matches.length === 0) {
    throw new Error(`${kind} não encontrado: "${name}"`);
  }
  const candidates = matches
    .map((match) => `${match.name} (${match.id})`)
    .join(", ");
  throw new Error(`${kind} ambíguo "${name}" — candidatos: ${candidates}`);
}
