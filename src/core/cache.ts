// Cache TTL + LRU in-repo (NFR-4): poupa orçamento de rate limit em metadados
// de board/list. `Map` preserva ordem de inserção — usamos isso para o LRU:
// `get` reinsere a chave (vira a mais recente) e a eviction remove a primeira
// (a menos usada). `now` é injetável para testes determinísticos.
export class TtlLruCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get(key: string): V | undefined {
    if (this.ttlMs <= 0) return undefined;
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (this.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    // Marca como mais recentemente usada (reinsere no fim).
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.ttlMs <= 0) return; // TTL 0 desliga o cache.
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const lru = this.entries.keys().next().value;
      if (lru === undefined) break;
      this.entries.delete(lru);
    }
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }
}
