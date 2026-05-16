/**
 * EO field-level conflict resolution (handleDEF / handleINS).
 *
 * Pins the EO default: the latest real-world timestamp wins per field,
 * regardless of the order the fold processed concurrent edits. The losing
 * event stays in the append-only log (the source of truth) — nothing is
 * dropped — so conflicts remain queryable for surfacing.
 */

import { describe, it, expect } from 'vitest';
import { processEvent } from '../fold';
import { getState } from '../state';
import type { EoStore } from '../encrypted-store';
import type { EoEventInput } from '../types';

function createTestStore(): EoStore {
  const data = new Map<string, any>();
  let seq = 0;
  return {
    async get(key: string) { return data.has(key) ? data.get(key) : null; },
    async put(key: string, value: any) { data.set(key, value); },
    async del(key: string) { data.delete(key); },
    async iterator(prefix: string) {
      const results: [string, any][] = [];
      for (const [key, value] of data.entries()) {
        if (key >= prefix && key <= prefix + '￿') results.push([key, value]);
      }
      results.sort((a, b) => a[0].localeCompare(b[0]));
      return results;
    },
    async nextSeq() { seq += 1; data.set('meta:seq', seq); return seq; },
    async getCurrentSeq() { return seq; },
    close() {},
  };
}

const ev = (
  op: EoEventInput['op'],
  target: string,
  operand: unknown,
  ts: string,
  agent: string,
  cid: string,
): EoEventInput => ({ op, target, operand, agent, ts, acquired_ts: ts, client_event_id: cid });

describe('handleDEF — EO field-level conflict resolution', () => {
  it('resolves a contested field by latest timestamp, not fold order', async () => {
    const store = createTestStore();
    await processEvent(store, ev('INS', 'app.t.r1', { status: 'new' }, '2025-01-01T00:00:00Z', '@a:m', 'c0'));
    // The later real-world edit is folded FIRST...
    await processEvent(store, ev('DEF', 'app.t.r1', { status: 'late' }, '2025-01-01T10:05:00Z', '@a:m', 'c-late'));
    // ...and an earlier edit from another agent arrives SECOND (partition heal).
    await processEvent(store, ev('DEF', 'app.t.r1', { status: 'early' }, '2025-01-01T10:00:00Z', '@b:m', 'c-early'));

    const s = await getState(store, 'app.t.r1');
    expect(s!.value.status).toBe('late'); // latest ts wins despite fold order
  });

  it('rejects a stale write that arrives after a newer one', async () => {
    const store = createTestStore();
    await processEvent(store, ev('INS', 'app.t.r2', { status: 'a' }, '2025-01-01T00:00:00Z', '@a:m', 'd0'));
    await processEvent(store, ev('DEF', 'app.t.r2', { status: 'c' }, '2025-01-01T02:00:00Z', '@b:m', 'd2'));
    // A stale edit (older ts) arriving late must not overwrite the newer value.
    await processEvent(store, ev('DEF', 'app.t.r2', { status: 'b' }, '2025-01-01T01:00:00Z', '@a:m', 'd1'));

    const s = await getState(store, 'app.t.r2');
    expect(s!.value.status).toBe('c');
  });

  it('is deterministic — concurrent edits resolve identically in any fold order', async () => {
    const ins = ev('INS', 'app.t.r3', { status: 's' }, '2025-01-01T00:00:00Z', '@a:m', 'e0');
    const editA = ev('DEF', 'app.t.r3', { status: 'A' }, '2025-01-01T09:00:00Z', '@a:m', 'e-A');
    const editB = ev('DEF', 'app.t.r3', { status: 'B' }, '2025-01-01T09:30:00Z', '@b:m', 'e-B');

    async function fold(order: EoEventInput[]): Promise<any> {
      const store = createTestStore();
      for (const e of order) await processEvent(store, e);
      return (await getState(store, 'app.t.r3'))!.value;
    }

    const v1 = await fold([ins, editA, editB]);
    const v2 = await fold([ins, editB, editA]);
    expect(v1.status).toBe('B'); // later real-world ts
    // The whole projected value — including `_writes` — is byte-identical no
    // matter which order the fold saw the concurrent edits.
    expect(v1).toEqual(v2);
  });

  it('keeps independent fields independent', async () => {
    const store = createTestStore();
    await processEvent(store, ev('INS', 'app.t.r4', { a: 1, b: 1 }, '2025-01-01T00:00:00Z', '@a:m', 'f0'));
    await processEvent(store, ev('DEF', 'app.t.r4', { a: 2 }, '2025-01-01T05:00:00Z', '@a:m', 'f1'));
    // Stale edit to `b` only — loses (older than the INS baseline), and must
    // not disturb the winning `a`.
    await processEvent(store, ev('DEF', 'app.t.r4', { b: 99 }, '2024-01-01T00:00:00Z', '@b:m', 'f2'));

    const s = await getState(store, 'app.t.r4');
    expect(s!.value.a).toBe(2);
    expect(s!.value.b).toBe(1); // stale write rejected against the INS baseline
  });
});
