/**
 * Minimal in-memory Redis used by realtime unit tests. Implements exactly the
 * commands the presence registry and version store rely on (hashes, strings
 * and the compare-and-set `eval`) so tests run without a Redis instance.
 */
export class InMemoryRedis {
  private readonly strings = new Map<string, string>();
  private readonly hashes = new Map<string, Map<string, string>>();

  reset(): void {
    this.strings.clear();
    this.hashes.clear();
  }

  set(key: string, value: string): Promise<'OK'> {
    this.strings.set(key, value);
    return Promise.resolve('OK');
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.strings.get(key) ?? null);
  }

  del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.strings.delete(key)) {
        removed += 1;
      }
      if (this.hashes.delete(key)) {
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }

  expire(key: string, seconds: number): Promise<number> {
    const exists = this.strings.has(key) || this.hashes.has(key);
    return Promise.resolve(exists && seconds > 0 ? 1 : 0);
  }

  hset(key: string, field: string, value: string): Promise<number> {
    let hash = this.hashes.get(key);
    if (hash === undefined) {
      hash = new Map<string, string>();
      this.hashes.set(key, hash);
    }
    const existed = hash.has(field);
    hash.set(field, value);
    return Promise.resolve(existed ? 0 : 1);
  }

  hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    return Promise.resolve(hash === undefined ? {} : Object.fromEntries(hash));
  }

  hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(key);
    if (hash === undefined) {
      return Promise.resolve(0);
    }
    let removed = 0;
    for (const field of fields) {
      if (hash.delete(field)) {
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }

  /** Mirrors the compare-and-set Lua script used by the element version store. */
  eval(_script: string, keys: string[], args: string[]): Promise<number> {
    const incoming = Number.parseInt(args[0], 10);
    const raw = this.strings.get(keys[0]);
    const current = raw === undefined ? 0 : Number.parseInt(raw, 10);
    if (incoming > current) {
      this.strings.set(keys[0], String(incoming));
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }
}
