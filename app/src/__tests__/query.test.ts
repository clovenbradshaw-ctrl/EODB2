import { describe, it, expect } from 'vitest';
import type { Entity } from '../foundation/fold.js';
import {
  applyFilters,
  applySort,
  operatorsFor,
  needsValue,
  defaultOperator,
  type Filter,
  type Sort,
} from '../query';

function row(anchor: string, overrides: Record<string, unknown> = {}): Entity {
  return {
    _anchor: anchor,
    _type: 'task',
    _created: 1000,
    _hwm: 6,
    ...overrides,
  };
}

describe('query filters', () => {
  const rows: Entity[] = [
    row('a', { name: 'Buy milk', done: true, n: 5, prio: 'high', when: '2026-05-01' }),
    row('b', { name: 'Walk dog', done: false, n: 3, prio: 'low', when: '2026-05-15' }),
    row('c', { name: 'Pay bills', done: false, n: 10, prio: 'medium', when: null }),
    row('d', { name: null }),
  ];

  it('text contains is case-insensitive', () => {
    const f: Filter = { field: 'name', fieldType: 'text', op: 'contains', value: 'BILL' };
    expect(applyFilters(rows, [f]).map((r) => r._anchor)).toEqual(['c']);
  });

  it('text empty / not_empty', () => {
    expect(applyFilters(rows, [{ field: 'name', fieldType: 'text', op: 'empty' }]).map((r) => r._anchor)).toEqual(['d']);
    expect(applyFilters(rows, [{ field: 'name', fieldType: 'text', op: 'not_empty' }]).map((r) => r._anchor)).toEqual(['a', 'b', 'c']);
  });

  it('checkbox is_checked / is_unchecked', () => {
    expect(applyFilters(rows, [{ field: 'done', fieldType: 'checkbox', op: 'is_checked' }]).map((r) => r._anchor)).toEqual(['a']);
    // Unchecked includes missing values (truthy: undefined is falsy).
    expect(applyFilters(rows, [{ field: 'done', fieldType: 'checkbox', op: 'is_unchecked' }]).map((r) => r._anchor)).toEqual(['b', 'c', 'd']);
  });

  it('number eq/gt/lt with non-numeric value rejects', () => {
    expect(applyFilters(rows, [{ field: 'n', fieldType: 'number', op: 'gt', value: 4 }]).map((r) => r._anchor)).toEqual(['a', 'c']);
    expect(applyFilters(rows, [{ field: 'n', fieldType: 'number', op: 'lte', value: 5 }]).map((r) => r._anchor)).toEqual(['a', 'b']);
    expect(applyFilters(rows, [{ field: 'n', fieldType: 'number', op: 'eq', value: 'nope' }])).toHaveLength(0);
  });

  it('select equals / not_equals', () => {
    expect(applyFilters(rows, [{ field: 'prio', fieldType: 'select', op: 'equals', value: 'high' }]).map((r) => r._anchor)).toEqual(['a']);
    expect(applyFilters(rows, [{ field: 'prio', fieldType: 'select', op: 'not_equals', value: 'high' }]).map((r) => r._anchor)).toEqual(['b', 'c']);
  });

  it('date before / after / on (string ISO ordering)', () => {
    expect(applyFilters(rows, [{ field: 'when', fieldType: 'date', op: 'before', value: '2026-05-10' }]).map((r) => r._anchor)).toEqual(['a']);
    expect(applyFilters(rows, [{ field: 'when', fieldType: 'date', op: 'after', value: '2026-05-10' }]).map((r) => r._anchor)).toEqual(['b']);
    expect(applyFilters(rows, [{ field: 'when', fieldType: 'date', op: 'on', value: '2026-05-15' }]).map((r) => r._anchor)).toEqual(['b']);
  });

  it('combines filters with AND', () => {
    const filters: Filter[] = [
      { field: 'done', fieldType: 'checkbox', op: 'is_unchecked' },
      { field: 'n', fieldType: 'number', op: 'gte', value: 5 },
    ];
    expect(applyFilters(rows, filters).map((r) => r._anchor)).toEqual(['c']);
  });

  it('returns the input array reference when filters is empty', () => {
    expect(applyFilters(rows, [])).toBe(rows);
  });
});

describe('query sort', () => {
  const rows: Entity[] = [
    row('a', { name: 'Carrot', n: 5 }),
    row('b', { name: 'apple', n: 3 }),
    row('c', { name: 'Banana', n: 8 }),
    row('d', { n: 1 }), // empty name
  ];

  it('sorts text asc with empty pinned to end', () => {
    const s: Sort = { field: 'name', fieldType: 'text', dir: 'asc' };
    expect(applySort(rows, s).map((r) => r._anchor)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('sorts text desc with empty still pinned to end', () => {
    const s: Sort = { field: 'name', fieldType: 'text', dir: 'desc' };
    expect(applySort(rows, s).map((r) => r._anchor)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('sorts numbers numerically, not lexicographically', () => {
    const s: Sort = { field: 'n', fieldType: 'number', dir: 'asc' };
    // 1, 3, 5, 8
    expect(applySort(rows, s).map((r) => r._anchor)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('null sort leaves order unchanged', () => {
    expect(applySort(rows, null)).toBe(rows);
  });
});

describe('operator metadata', () => {
  it('operatorsFor returns the right ops per type', () => {
    expect(operatorsFor('checkbox')).toEqual(['is_checked', 'is_unchecked']);
    expect(operatorsFor('text')).toContain('contains');
    expect(operatorsFor('number')).toContain('gte');
  });

  it('needsValue is false for empty/checkbox-style ops', () => {
    expect(needsValue('empty')).toBe(false);
    expect(needsValue('not_empty')).toBe(false);
    expect(needsValue('is_checked')).toBe(false);
    expect(needsValue('is_unchecked')).toBe(false);
    expect(needsValue('contains')).toBe(true);
    expect(needsValue('gt')).toBe(true);
  });

  it('defaultOperator picks the first operator for a type', () => {
    expect(defaultOperator('checkbox')).toBe('is_checked');
    expect(defaultOperator('text')).toBe('contains');
  });
});
