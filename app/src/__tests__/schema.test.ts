import { describe, it, expect, beforeAll } from 'vitest';
import { setNamespace } from '../foundation/operators.js';
import { fold } from '../foundation/fold.js';
import {
  coerceValue,
  formatValue,
  getFieldSchema,
  getTypeFields,
} from '../schema';

const NS = 'com.test.eodb';

function evt(opKey: string, content: unknown, ts: number) {
  return {
    type: `${NS}.${opKey}`,
    content,
    origin_server_ts: ts,
    sender: '@alice:test',
    event_id: `$${Math.random().toString(36).slice(2)}`,
  };
}

beforeAll(() => {
  setNamespace(NS);
});

describe('schema helpers', () => {
  it('coerceValue parses numbers, booleans, dates, selects, and text', () => {
    expect(coerceValue('number', '42')).toBe(42);
    expect(coerceValue('number', '')).toBeNull();
    expect(coerceValue('number', 'abc')).toBe('abc'); // unparseable → keep string
    expect(coerceValue('checkbox', 'true')).toBe(true);
    expect(coerceValue('checkbox', 'false')).toBe(false);
    expect(coerceValue('checkbox', '1')).toBe(true);
    expect(coerceValue('date', '2026-05-25')).toBe('2026-05-25');
    expect(coerceValue('date', '')).toBeNull();
    expect(coerceValue('select', 'high')).toBe('high');
    expect(coerceValue('text', 'hello ')).toBe('hello '); // text preserves whitespace
  });

  it('formatValue renders typed values to display strings', () => {
    expect(formatValue('text', null)).toBe('');
    expect(formatValue('text', undefined)).toBe('');
    expect(formatValue('number', 0)).toBe('0');
    expect(formatValue('number', 42)).toBe('42');
    expect(formatValue('checkbox', true)).toBe('true');
    expect(formatValue('checkbox', false)).toBe('false');
    expect(formatValue('select', 'low')).toBe('low');
    expect(formatValue('text', { x: 1 })).toBe('{"x":1}');
  });

  it('getTypeFields reads a schema populated via defSchema events', () => {
    const state = fold([
      evt('def', { anchor: null, path: '_schema.task.fields.name.type', value: 'text' }, 1000),
      evt('def', { anchor: null, path: '_schema.task.fields.name.order', value: 0 }, 1010),
      evt('def', { anchor: null, path: '_schema.task.fields.done.type', value: 'checkbox' }, 1020),
      evt('def', { anchor: null, path: '_schema.task.fields.done.order', value: 1 }, 1030),
      evt(
        'def',
        {
          anchor: null,
          path: '_schema.task.fields.priority.type',
          value: 'select',
        },
        1040,
      ),
      evt(
        'def',
        {
          anchor: null,
          path: '_schema.task.fields.priority.options',
          value: ['low', 'medium', 'high'],
        },
        1050,
      ),
      evt('def', { anchor: null, path: '_schema.task.fields.priority.order', value: 2 }, 1060),
    ]);

    const fields = getTypeFields(state, 'task');
    expect(fields.map((f) => f.name)).toEqual(['name', 'done', 'priority']);
    expect(fields[0].type).toBe('text');
    expect(fields[1].type).toBe('checkbox');
    expect(fields[2].type).toBe('select');
    expect(fields[2].options).toEqual(['low', 'medium', 'high']);

    const priority = getFieldSchema(state, 'task', 'priority');
    expect(priority?.type).toBe('select');
    expect(priority?.options).toEqual(['low', 'medium', 'high']);
  });

  it('falls back to type=text when no schema entry exists', () => {
    const state = fold([]);
    expect(getTypeFields(state, 'unknown')).toEqual([]);
    expect(getFieldSchema(state, 'unknown', 'foo')).toBeNull();
  });

  it('orders fields by order field, name as tiebreaker', () => {
    const state = fold([
      evt('def', { anchor: null, path: '_schema.t.fields.a.type', value: 'text' }, 1),
      evt('def', { anchor: null, path: '_schema.t.fields.a.order', value: 2 }, 2),
      evt('def', { anchor: null, path: '_schema.t.fields.b.type', value: 'text' }, 3),
      evt('def', { anchor: null, path: '_schema.t.fields.b.order', value: 1 }, 4),
      evt('def', { anchor: null, path: '_schema.t.fields.c.type', value: 'text' }, 5),
      // c has no order — defaults to 0
    ]);
    const fields = getTypeFields(state, 't');
    expect(fields.map((f) => f.name)).toEqual(['c', 'b', 'a']);
  });
});
