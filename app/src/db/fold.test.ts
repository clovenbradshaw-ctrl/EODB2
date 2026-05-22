import { describe, it, expect } from 'vitest';
import { applyEvent, fold } from './fold';
import type { EoEvent } from './types';

const ev = (site: string, operator: EoEvent['operator'], resolution: Record<string, any>, ts: number, event_id = `$${ts}`): EoEvent => ({
  operator, site, resolution, ts, agent: '@a:b', event_id,
});

describe('fold', () => {
  it('INS creates a site', () => {
    const s = fold([ev('case:1', 'INS', { status: 'open' }, 1)]);
    expect(s.get('case:1')?.resolution).toEqual({ status: 'open' });
  });

  it('DEF merges resolution fields', () => {
    const s = fold([
      ev('case:1', 'INS', { status: 'open' }, 1),
      ev('case:1', 'DEF', { assignee: 'kevin' }, 2),
    ]);
    expect(s.get('case:1')?.resolution).toEqual({ status: 'open', assignee: 'kevin' });
  });

  it('NUL clears the resolution but keeps a tombstone', () => {
    const s = fold([
      ev('case:1', 'INS', { status: 'open' }, 1),
      ev('case:1', 'NUL', {}, 2),
    ]);
    expect(s.get('case:1')).toBeDefined();
    expect(s.get('case:1')?.cleared).toBe(true);
    expect(s.get('case:1')?.resolution).toEqual({});
  });

  it('events arriving out of order: last-ts-wins', () => {
    let s = new Map();
    s = applyEvent(s, ev('case:1', 'INS', { v: 'late' }, 5));
    s = applyEvent(s, ev('case:1', 'DEF', { v: 'early' }, 1)); // older — should be ignored for snapshot
    expect(s.get('case:1')?.resolution).toEqual({ v: 'late' });
  });

  it('later INS after NUL restores the site', () => {
    const s = fold([
      ev('case:1', 'INS', { status: 'open' }, 1),
      ev('case:1', 'NUL', {}, 2),
      ev('case:1', 'INS', { status: 'closed' }, 3),
    ]);
    expect(s.get('case:1')?.cleared).toBe(false);
    expect(s.get('case:1')?.resolution).toEqual({ status: 'closed' });
  });

  it('multiple sites are independent', () => {
    const s = fold([
      ev('a', 'INS', { x: 1 }, 1),
      ev('b', 'INS', { y: 2 }, 2),
    ]);
    expect(s.size).toBe(2);
    expect(s.get('a')?.resolution).toEqual({ x: 1 });
    expect(s.get('b')?.resolution).toEqual({ y: 2 });
  });
});
