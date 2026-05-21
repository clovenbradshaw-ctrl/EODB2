/**
 * publish-events tests — the resilience contract for the inline send loop.
 *
 * The pre-Fix-1 behaviour was: any throw in the per-event loop bubbled up
 * to the caller, leaving earlier events sent and later events silently
 * skipped. With `sendEoEvent` now wrapped in `withRetry` and the loop
 * catching terminal failures into the offline queue, a 429 mid-batch can
 * no longer truncate the canonical timeline. These tests pin that
 * contract so it can't regress.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { publishEoEventBatch } from '../publish-events';
import { offlineQueueDepth } from '../../matrix/offline-queue';
import type { EoEventInput } from '../../db/types';

function makeEvent(seq: number): EoEventInput {
  return {
    op: 'DEF',
    target: `app.tbl.rec${seq}`,
    operand: { v: seq },
    agent: '@u:test',
    ts: `2026-01-01T00:00:${String(seq).padStart(2, '0')}Z`,
    acquired_ts: `2026-01-01T00:00:${String(seq).padStart(2, '0')}Z`,
    client_event_id: `ev-${seq}`,
  };
}

function rateLimitError(retryAfterMs: number): Error {
  const e = new Error('M_LIMIT_EXCEEDED') as any;
  e.httpStatus = 429;
  e.errcode = 'M_LIMIT_EXCEEDED';
  e.data = { retry_after_ms: retryAfterMs };
  return e;
}

function permanentError(): Error {
  const e = new Error('Forbidden') as any;
  e.httpStatus = 403;
  return e;
}

describe('publishEoEventBatch — inline path resilience', () => {
  it('retries a transient 429 transparently and still sends every event', async () => {
    const events = [makeEvent(1), makeEvent(2), makeEvent(3)];
    let sendCalls = 0;
    let failuresLeft = 1; // event 2's first attempt 429s, then succeeds.

    const client = {
      sendEvent: vi.fn(async () => {
        sendCalls += 1;
        if (sendCalls === 2 && failuresLeft > 0) {
          failuresLeft -= 1;
          throw rateLimitError(10);
        }
        return { event_id: `$ev${sendCalls}` };
      }),
    } as any;

    const result = await publishEoEventBatch(client, '!room-retry:m', events);

    expect(result.mode).toBe('inline');
    expect(result.eventCount).toBe(3);
    expect(result.inlineEventIds.length).toBe(3);
    expect(result.queuedCount).toBe(0);
    // 3 events but event 2 was retried once → 4 total sendEvent invocations.
    expect(sendCalls).toBe(4);
  });

  it('parks events on the offline queue when a send terminally fails, instead of truncating the batch', async () => {
    const roomId = `!room-perm-${Date.now()}:m`;
    const events = [makeEvent(11), makeEvent(12), makeEvent(13)];
    let sendCalls = 0;

    const client = {
      sendEvent: vi.fn(async () => {
        sendCalls += 1;
        // Event 2 of 3 hits a permanent 403 (e.g. power-level violation).
        // Without the catch-and-enqueue, event 3 would never be attempted.
        if (sendCalls === 2) throw permanentError();
        return { event_id: `$ev${sendCalls}` };
      }),
    } as any;

    // Silence the expected console.warn so the test output stays readable.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await publishEoEventBatch(client, roomId, events);

    expect(result.mode).toBe('inline');
    expect(result.eventCount).toBe(3);
    // Event 1 and event 3 both made it onto the timeline; event 2 was
    // parked durably rather than silently dropped.
    expect(result.inlineEventIds.length).toBe(2);
    expect(result.queuedCount).toBe(1);
    expect(await offlineQueueDepth(roomId)).toBe(1);

    warnSpy.mockRestore();
  });
});
