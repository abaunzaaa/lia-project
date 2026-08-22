/**
 * Cache en memoria con TTL. Sin Redis ni PostgreSQL.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }
}

export const drugReferenceCache = new MemoryCache();

export const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
export const INFO_CACHE_TTL_MS = 45 * 60 * 1000; // 45 min
