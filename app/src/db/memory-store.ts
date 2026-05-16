/**
 * In-memory EoStore — replaces the IDB-backed encrypted-store for the
 * live session.
 *
 * All data lives in a plain Map. On page load the fold worker's OPFS log
 * is replayed into this store via replayFromLog() (fold.ts). On every
 * subsequent event write, the "persistence hook" forwards the event to
 * the fold worker so it is durably appended to the OPFS log.
 *
 * The store is intentionally NOT encrypted because the OPFS binary log
 * (fold worker) is the source of truth for durability. Encryption of the
 * OPFS layer can be added as a separate concern.
 */

import type { EoStore, IteratorOpts } from './encrypted-store';
import type { EoEvent } from './types';

export interface MemoryStore extends EoStore {
  /**
   * Call once after replay is complete. All future log: writes will be
   * forwarded to `fn` so the fold worker can persist them to OPFS. If `fn`
   * returns a Promise it is tracked internally and awaited by
   * `awaitPersistence`, so callers can use a fire-and-forget callback for
   * latency but still know when the queue has drained for durability
   * barriers (e.g. before writing a kv-snapshot).
   */
  enablePersistence(fn: (event: EoEvent) => void | Promise<void>): void;
  /**
   * Resolve once every outstanding persistFn promise has settled. Safe to
   * call repeatedly; resolves immediately when nothing is in flight.
   *
   * Use this before taking a kv-snapshot or surfacing "saved" to the user —
   * without it, `flushToOpfs` can capture a kv-map whose log: entries
   * haven't yet been written to OPFS, breaking reload survival for bursts.
   */
  awaitPersistence(): Promise<void>;
  /**
   * Return all kv entries as an array for snapshotting.
   * Used by eo-store to save kv-snapshot.bin to OPFS after init.
   */
  getKvEntries(): [string, unknown][];
}

export function createMemoryStore(opts?: {
  initialKv?: [string, unknown][];
  initialSeq?: number;
}): MemoryStore {
  const kv = new Map<string, unknown>(opts?.initialKv);
  let currentSeq = opts?.initialSeq ?? 0;
  let persistFn: ((e: EoEvent) => void | Promise<void>) | null = null;
  // Tracks every persistFn promise still in flight. Each entry removes
  // itself on settle, so the set is a live view of outstanding writes.
  const pendingPersistence = new Set<Promise<void>>();

  // ─── Sorted-key index ──────────────────────────────────────────────────
  //
  // `rangeKeys` used to spread + filter + sort the entire keyspace on every
  // call. A paged scan of a 100k-record table (200 pages) therefore re-sorted
  // ~100k keys 200 times — the dominant cost of opening a large table.
  //
  // Instead we cache the sorted key list and invalidate it only when the SET
  // of keys changes (a brand-new key, or a deletion). Value-only updates
  // (`put` on an existing key, the `meta:seq` bump) leave it valid. Each
  // `rangeKeys` call is then a binary search + a linear walk of just the
  // requested page.
  let sortedKeys: string[] | null = null;

  function invalidateSortedKeys(): void {
    sortedKeys = null;
  }

  function getSortedKeys(): string[] {
    if (sortedKeys === null) {
      sortedKeys = [...kv.keys()].sort();
    }
    return sortedKeys;
  }

  /** First index into `sorted` whose key is >= `target` (binary search). */
  function lowerBound(sorted: string[], target: string): number {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function rangeKeys(prefix: string, opts?: IteratorOpts): string[] {
    const sorted = getSortedKeys();
    // Page starts at `prefix`, or strictly after `afterKey` when it is a
    // cursor inside the prefix range.
    const afterKey = opts?.afterKey;
    const startKey = afterKey && afterKey > prefix ? afterKey : prefix;
    let i = lowerBound(sorted, startKey);
    if (afterKey !== undefined && sorted[i] === afterKey) i++;

    const result: string[] = [];
    const limit = opts?.limit;
    for (; i < sorted.length; i++) {
      const k = sorted[i];
      if (!k.startsWith(prefix)) break; // sorted — once out of range, done
      result.push(k);
      if (limit !== undefined && result.length >= limit) break;
    }
    return result;
  }

  const store: MemoryStore = {
    async get(key: string): Promise<unknown> {
      return (kv.get(key) as unknown) ?? null;
    },

    async put(key: string, value: unknown): Promise<void> {
      // A brand-new key changes the sorted key set; a value-only update
      // does not.
      if (!kv.has(key)) invalidateSortedKeys();
      kv.set(key, value);
      // Forward event writes to the OPFS fold worker for durability.
      // The forward is fire-and-forget for latency, but if persistFn
      // returns a promise we track it so awaitPersistence() can drain
      // the queue before a kv-snapshot is written.
      if (persistFn && key.startsWith('log:')) {
        const r = persistFn(value as EoEvent);
        if (r && typeof (r as Promise<void>).then === 'function') {
          const p = r as Promise<void>;
          pendingPersistence.add(p);
          // Always settle: never let a rejection bubble out of put().
          p.catch(() => {}).finally(() => pendingPersistence.delete(p));
        }
      }
    },

    async del(key: string): Promise<void> {
      if (kv.delete(key)) invalidateSortedKeys();
    },

    async iterator(prefix: string, opts?: IteratorOpts): Promise<[string, unknown][]> {
      return rangeKeys(prefix, opts).map((k) => [k, kv.get(k)] as [string, unknown]);
    },

    async nextSeq(): Promise<number> {
      currentSeq++;
      if (!kv.has('meta:seq')) invalidateSortedKeys();
      kv.set('meta:seq', currentSeq);
      return currentSeq;
    },

    async getCurrentSeq(): Promise<number> {
      return currentSeq;
    },

    close(): void {
      // No-op — in-memory store has no resources to release.
      // The fold worker (if any) is managed externally.
    },

    enablePersistence(fn: (event: EoEvent) => void | Promise<void>): void {
      persistFn = fn;
    },

    async awaitPersistence(): Promise<void> {
      // Re-check after each settle: a draining promise may have spawned
      // its own follow-on write (it doesn't today, but the loop costs
      // nothing and protects future implementations).
      while (pendingPersistence.size > 0) {
        await Promise.allSettled([...pendingPersistence]);
      }
    },

    getKvEntries(): [string, unknown][] {
      return [...kv.entries()];
    },
  };

  return store;
}
