/**
 * Phase 1 — the durability barrier.
 *
 * Pins the coordinator's two load-bearing guarantees:
 *   1. `durableSeq` only advances once the OPFS log has acked the append.
 *   2. Every `snapshot()` drains the append queue first, so a snapshot is
 *      never captured while writes for its own `seq` are still in flight.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EoEvent } from '../types';

const mocks = vi.hoisted(() => ({
  appendRaw: vi.fn(),
  saveKvSnapshot: vi.fn(),
  saveInitCache: vi.fn(),
}));

vi.mock('../lazy-fold', () => ({
  appendRaw: mocks.appendRaw,
  saveKvSnapshot: mocks.saveKvSnapshot,
  saveInitCache: mocks.saveInitCache,
}));

import { createPersistenceCoordinator } from '../persistence-coordinator';
import type { FoldWorkerClient } from '../lazy-fold';

const client = {} as FoldWorkerClient;

const ev = (seq: number): EoEvent => ({
  seq,
  op: 'DEF',
  target: `t.${seq}`,
  operand: { v: seq },
  agent: '@test:test',
  ts: '2024-01-01T00:00:00Z',
  acquired_ts: '2024-01-01T00:00:00Z',
  client_event_id: `cid-${seq}`,
});

/** A promise plus its resolve/reject handles, for controlling append timing. */
function deferred(): { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void } {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mocks.appendRaw.mockReset().mockResolvedValue(undefined);
  mocks.saveKvSnapshot.mockReset().mockResolvedValue(undefined);
  mocks.saveInitCache.mockReset().mockResolvedValue(undefined);
});

describe('PersistenceCoordinator', () => {
  it('advances durableSeq only after the append is acked', async () => {
    const d = deferred();
    mocks.appendRaw.mockReturnValueOnce(d.promise);
    const coord = createPersistenceCoordinator(client);

    const append = coord.append(ev(7));
    // Append is in flight — the log has not acked, so durableSeq stays 0.
    expect(coord.durableSeq).toBe(0);

    d.resolve();
    await append;
    expect(coord.durableSeq).toBe(7);
  });

  it('durableSeq tracks the highest acked seq across out-of-order acks', async () => {
    const d1 = deferred();
    const d2 = deferred();
    mocks.appendRaw.mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
    const coord = createPersistenceCoordinator(client);

    const a1 = coord.append(ev(1));
    const a2 = coord.append(ev(2));

    // Second append acks first.
    d2.resolve();
    await a2;
    expect(coord.durableSeq).toBe(2);

    // First append acks later — durableSeq must not regress.
    d1.resolve();
    await a1;
    expect(coord.durableSeq).toBe(2);
  });

  it('snapshot drains in-flight appends before writing the kv-snapshot', async () => {
    const d = deferred();
    mocks.appendRaw.mockReturnValueOnce(d.promise);
    const coord = createPersistenceCoordinator(client);

    void coord.append(ev(1));
    const snap = coord.snapshot({ entries: [], recentTail: [], seq: 1 });

    // Append still in flight — the snapshot must not have been written yet.
    await Promise.resolve();
    expect(mocks.saveKvSnapshot).not.toHaveBeenCalled();

    d.resolve();
    await snap;
    expect(mocks.saveKvSnapshot).toHaveBeenCalledTimes(1);
  });

  it('snapshot still writes the kv map when an append failed', async () => {
    mocks.appendRaw.mockRejectedValueOnce(new Error('OPFS quota exceeded'));
    const coord = createPersistenceCoordinator(client);

    // Route the rejection the way MemoryStore does — swallowed at the call site.
    await coord.append(ev(1)).catch(() => {});

    const result = await coord.snapshot({
      entries: [['log:1', ev(1)]],
      recentTail: [ev(1)],
      seq: 1,
    });

    // The log never acked the event (durableSeq stayed 0), but the snapshot
    // still captured it — the kv map is the catch-all recovery path.
    expect(mocks.saveKvSnapshot).toHaveBeenCalledTimes(1);
    expect(result.durableSeq).toBe(0);
    expect(coord.hasError).toBe(true);
  });

  it('awaitDurable surfaces an append failure exactly once', async () => {
    mocks.appendRaw.mockRejectedValueOnce(new Error('worker died'));
    const coord = createPersistenceCoordinator(client);

    await coord.append(ev(1)).catch(() => {});

    await expect(coord.awaitDurable()).rejects.toThrow('worker died');
    // The error is consumed — a clean run after it resolves.
    await expect(coord.awaitDurable()).resolves.toBeUndefined();
  });

  it('awaitDurable resolves when nothing is in flight', async () => {
    const coord = createPersistenceCoordinator(client);
    await expect(coord.awaitDurable()).resolves.toBeUndefined();
  });

  it('markDurable seeds the cursor and never lowers it', () => {
    const coord = createPersistenceCoordinator(client);
    expect(coord.durableSeq).toBe(0);
    coord.markDurable(500);
    expect(coord.durableSeq).toBe(500);
    coord.markDurable(200);
    expect(coord.durableSeq).toBe(500);
  });

  it('a snapshot at the seeded durable seq does not warn (boot path)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const coord = createPersistenceCoordinator(client);
    // Simulate boot: the OPFS log already holds 100k events from prior
    // sessions, so the coordinator is seeded before the post-init snapshot.
    coord.markDurable(100_001);
    const result = await coord.snapshot({ entries: [], recentTail: [], seq: 100_001 });
    expect(result.durableSeq).toBe(100_001);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
