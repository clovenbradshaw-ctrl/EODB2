/**
 * Durable offline event queue.
 *
 * The guarantee under test: an event that cannot reach its room's timeline
 * is never dropped — it stays queued (no attempt cap) until a send succeeds.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
  enqueueOfflineEvent,
  flushOfflineQueue,
  offlineQueueDepth,
} from '../offline-queue';
import type { EoEvent, EoEventInput } from '../../db/types';

let n = 0;
const ev = (): EoEvent => {
  n += 1;
  return {
    seq: n,
    op: 'DEF',
    target: `t.${n}`,
    operand: { v: n },
    agent: '@u:m',
    ts: '2025-01-01T00:00:00Z',
    acquired_ts: '2025-01-01T00:00:00Z',
    client_event_id: `cid-${n}`,
  };
};

describe('offline-queue', () => {
  it('flushes queued events through a succeeding sender', async () => {
    const room = `!flush-ok-${Date.now()}:m`;
    await enqueueOfflineEvent(room, ev());
    await enqueueOfflineEvent(room, ev());
    expect(await offlineQueueDepth(room)).toBe(2);

    const sent: EoEventInput[] = [];
    const result = await flushOfflineQueue(room, async (e) => { sent.push(e); });

    expect(result).toEqual({ sent: 2, remaining: 0 });
    expect(sent).toHaveLength(2);
    expect(await offlineQueueDepth(room)).toBe(0);
  });

  it('never drops an event whose send fails — it stays queued', async () => {
    const room = `!flush-fail-${Date.now()}:m`;
    await enqueueOfflineEvent(room, ev());

    const failing = await flushOfflineQueue(room, async () => {
      throw new Error('homeserver unreachable');
    });
    expect(failing).toEqual({ sent: 0, remaining: 1 });
    expect(await offlineQueueDepth(room)).toBe(1);

    // A later reconnect retries the same event and it finally lands.
    const ok = await flushOfflineQueue(room, async () => { /* sent */ });
    expect(ok).toEqual({ sent: 1, remaining: 0 });
    expect(await offlineQueueDepth(room)).toBe(0);
  });

  it('keeps each room’s queue independent', async () => {
    const roomA = `!room-a-${Date.now()}:m`;
    const roomB = `!room-b-${Date.now()}:m`;
    await enqueueOfflineEvent(roomA, ev());
    await enqueueOfflineEvent(roomB, ev());
    await enqueueOfflineEvent(roomB, ev());

    expect(await offlineQueueDepth(roomA)).toBe(1);
    expect(await offlineQueueDepth(roomB)).toBe(2);

    await flushOfflineQueue(roomA, async () => { /* sent */ });
    expect(await offlineQueueDepth(roomA)).toBe(0);
    expect(await offlineQueueDepth(roomB)).toBe(2); // untouched
  });
});
