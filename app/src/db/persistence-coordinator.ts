/**
 * Phase 1 — the durability barrier.
 *
 * A single owner for everything that makes a write survive a reload. Before
 * this, durability was spread across three independent on-disk artifacts with
 * three independent cursors:
 *
 *   - kv-snapshot.bin   keyed by `seq`
 *   - init-cache.bin    keyed by `logByteSize`
 *   - fold-position.bin keyed by `seq`
 *
 * None of them were written atomically with the OPFS event log or with each
 * other, so boot had to reconcile them with a pile of special cases, and a
 * snapshot taken mid-burst could claim a `seq` whose events were still in
 * flight to disk. `appendRaw` failures were swallowed by a bare `.catch()`,
 * so an event could be acknowledged in the UI while never reaching the log
 * OR a snapshot.
 *
 * The coordinator collapses that to ONE durability cursor — `durableSeq`, the
 * highest seq the OPFS log has acked — and ONE rule: every snapshot path
 * drains the append queue before the kv map is captured. The OPFS log is the
 * primary durable store; the kv-snapshot is the catch-all that always records
 * the full in-memory map, so even an event whose `appendRaw` failed survives
 * the next snapshot.
 *
 * This module is the only place that calls `appendRaw` / `saveKvSnapshot` /
 * `saveInitCache`. Everything else goes through `eo-store`, which holds one
 * coordinator per fold-worker client.
 */

import type { EoEvent } from './types';
import {
  appendRaw,
  saveKvSnapshot,
  saveInitCache,
  type FoldWorkerClient,
} from './lazy-fold';

export interface SnapshotInput {
  entries: [string, unknown][];
  recentTail: EoEvent[];
  /** The kv map's seq counter — the highest event seq the map contains. */
  seq: number;
  hydratedHead?: string | null;
}

export interface PersistenceCoordinator {
  /**
   * Append one already-folded event to the durable OPFS log. Resolves once
   * the fold worker has acked the write — the worker's `appendEvent` flushes
   * both log files synchronously, so an ack means the bytes are on disk.
   * Rejects if the write fails; callers that route through `MemoryStore`
   * already swallow that rejection, so `put()` never throws.
   */
  append(event: EoEvent): Promise<void>;
  /**
   * Resolve once every queued append has settled. Rejects with the first
   * append failure seen since the last call — durability errors are
   * surfaced here rather than vanishing into a `console.warn`.
   */
  awaitDurable(): Promise<void>;
  /**
   * Drain the append queue, then write the kv-snapshot and refresh the
   * init-cache. Draining first is the durability barrier: it guarantees the
   * snapshot is never captured while writes for its own `seq` are still in
   * flight to the log.
   */
  snapshot(input: SnapshotInput): Promise<{ seq: number; durableSeq: number }>;
  /**
   * Record that the OPFS log is already durable through `seq`. Used on boot
   * to seed the cursor with the log head the worker restored from disk —
   * the coordinator only observes appends made during the current session,
   * so without this seed a post-init snapshot (whose kv map was rebuilt
   * from that already-durable log) would false-positive as "snapshot-only".
   * Monotonic: never lowers `durableSeq`.
   */
  markDurable(seq: number): void;
  /**
   * Highest seq durably acked by the OPFS log. The single durability cursor
   * — it replaces the independent kv-snapshot / init-cache / fold-position
   * seq cursors as the authority for "how far is durable".
   */
  readonly durableSeq: number;
  /** True if an append failed and the error has not yet been observed. */
  readonly hasError: boolean;
}

export function createPersistenceCoordinator(
  client: FoldWorkerClient,
): PersistenceCoordinator {
  // Live view of appends still in flight. Each entry removes itself on
  // settle, so the set is always the current outstanding-write count.
  const pending = new Set<Promise<unknown>>();
  let durableSeq = 0;
  let lastError: unknown = null;

  function append(event: EoEvent): Promise<void> {
    const p = appendRaw(client, event).then(
      () => {
        // The worker processes appends in postMessage order and flushes
        // each one synchronously, so once this resolves every event up to
        // and including `event.seq` is on disk.
        if (typeof event.seq === 'number' && event.seq > durableSeq) {
          durableSeq = event.seq;
        }
      },
      (err: unknown) => {
        lastError = err;
        console.warn(
          '[EO-DB] persistence: appendRaw failed for seq',
          event.seq,
          err,
        );
        throw err;
      },
    );
    pending.add(p);
    // A separate settle-tracking copy: `pending` keeps the original
    // (possibly-rejecting) promise so `drain` can await it, while this copy
    // guarantees the set is cleaned up without an unhandled rejection.
    p.catch(() => {}).finally(() => pending.delete(p));
    return p;
  }

  async function drain(): Promise<void> {
    // Re-check after each settle — a draining append could in principle
    // enqueue a follow-on write. It doesn't today, but the loop is free.
    while (pending.size > 0) {
      await Promise.allSettled([...pending]);
    }
  }

  async function awaitDurable(): Promise<void> {
    await drain();
    if (lastError !== null) {
      const err = lastError;
      lastError = null;
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async function snapshot(
    input: SnapshotInput,
  ): Promise<{ seq: number; durableSeq: number }> {
    // The durability barrier: drain every in-flight append before the kv
    // map is serialized. Without this a snapshot taken right after a write
    // burst records a `seq` whose events have not yet reached the log.
    await drain();

    if (input.seq > durableSeq) {
      // The kv map carries events the log has not durably acked — an append
      // failed, or events reached the map without going through the
      // coordinator. The snapshot still records them (the full kv map IS
      // the recovery path), but the gap is logged so it is observable
      // rather than silent.
      console.warn(
        `[EO-DB] persistence: snapshot seq ${input.seq} exceeds durable log ` +
          `seq ${durableSeq} — ${input.seq - durableSeq} event(s) are ` +
          `snapshot-only and not in the OPFS log`,
      );
    }

    await saveKvSnapshot(
      client,
      input.entries,
      input.recentTail,
      input.seq,
      input.hydratedHead,
    );
    // The init-cache is a buildIndex accelerator only — a failure to refresh
    // it never costs data, so it must not block or fail the snapshot.
    saveInitCache(client).catch((e) =>
      console.warn('[EO-DB] persistence: init-cache save failed:', e),
    );

    return { seq: input.seq, durableSeq };
  }

  function markDurable(seq: number): void {
    if (seq > durableSeq) durableSeq = seq;
  }

  return {
    append,
    awaitDurable,
    snapshot,
    markDurable,
    get durableSeq() {
      return durableSeq;
    },
    get hasError() {
      return lastError !== null;
    },
  };
}
