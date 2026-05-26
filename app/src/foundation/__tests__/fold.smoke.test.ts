import { describe, it, expect, beforeAll } from 'vitest';
import { setNamespace } from '../operators.js';
import { initial, fold, foldFrom, entitiesOfType } from '../fold.js';

const NS = 'com.test.eodb';

function evt(opKey: string, content: unknown, ts = Date.now()) {
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

describe('fold (smoke)', () => {
  it('returns an empty state from initial()', () => {
    const state = initial();
    expect(state.entities).toEqual({});
    expect(state.cursor).toBe(0);
    expect(state._violations).toEqual([]);
  });

  it('INS creates an entity with its anchor and type', () => {
    const state = fold([
      evt('ins', { anchor: 'task_abc', entity_type: 'task', payload: { title: 'Buy milk' } }, 1000),
    ]);
    expect(state.entities.task_abc).toBeDefined();
    expect(state.entities.task_abc._type).toBe('task');
    expect(state.entities.task_abc.title).toBe('Buy milk');
    expect(state.entities.task_abc._hwm).toBe(2);
  });

  it('DEF after INS sets a path on the entity', () => {
    const state = fold([
      evt('ins', { anchor: 'task_abc', entity_type: 'task', payload: {} }, 1000),
      evt('def', { anchor: 'task_abc', path: 'status', value: 'done' }, 1100),
    ]);
    expect(state.entities.task_abc.status).toBe('done');
    expect(state.entities.task_abc._hwm).toBeGreaterThanOrEqual(6);
  });

  it('SEG moves an entity into a partition', () => {
    const state = fold([
      evt('ins', { anchor: 'task_abc', entity_type: 'task', payload: {} }, 1000),
      evt('seg', { anchor: 'task_abc', partition: 'archived' }, 1200),
    ]);
    expect(state.partitions.task_abc).toBe('archived');
  });

  it('DEF without prior INS is flagged as a missing_ins violation', () => {
    const state = fold([
      evt('def', { anchor: 'ghost', path: 'x', value: 1 }, 1000),
    ]);
    expect(state._violations.length).toBe(1);
    expect(state._violations[0].type).toBe('missing_ins');
  });

  it('EVA before any DEF is flagged as criterionless_judgment', () => {
    const state = fold([
      evt('ins', { anchor: 'task_x', entity_type: 'task', payload: {} }, 1000),
      evt('eva', { anchor: 'task_x', criterion: 'done?', result: 'pass' }, 1100),
    ]);
    const violation = state._violations.find((v) => v.type === 'criterionless_judgment');
    expect(violation).toBeDefined();
  });

  it('foldFrom applies new events incrementally to existing state', () => {
    let state = fold([
      evt('ins', { anchor: 'a', entity_type: 'task', payload: { n: 1 } }, 1000),
    ]);
    state = foldFrom(state, [
      evt('def', { anchor: 'a', path: 'n', value: 2 }, 1100),
    ]);
    expect(state.entities.a.n).toBe(2);
  });

  it('entitiesOfType returns only entities of the requested type', () => {
    const state = fold([
      evt('ins', { anchor: 't1', entity_type: 'task', payload: {} }, 1000),
      evt('ins', { anchor: 'p1', entity_type: 'project', payload: {} }, 1100),
      evt('ins', { anchor: 't2', entity_type: 'task', payload: {} }, 1200),
    ]);
    const tasks = entitiesOfType(state, 'task');
    expect(tasks.map((e) => e._anchor).sort()).toEqual(['t1', 't2']);
  });
});
