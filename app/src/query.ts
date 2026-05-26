/**
 * query.ts — Pure filter + sort helpers
 *
 * Takes a flat array of entities + the schema's field map and returns
 * a new array filtered + sorted. No state, no side effects, no fold.
 * Used by the Grid and Kanban renderers so both views share the same
 * query semantics.
 */

import type { Entity } from './foundation/fold.js';
import type { FieldSchema, FieldType } from './schema';

export type FilterOperator =
  // Universal
  | 'empty'
  | 'not_empty'
  // Text
  | 'contains'
  | 'equals'
  | 'not_equals'
  // Number
  | 'eq'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  // Checkbox
  | 'is_checked'
  | 'is_unchecked'
  // Date
  | 'before'
  | 'after'
  | 'on';

export interface Filter {
  field: string;
  fieldType: FieldType;
  op: FilterOperator;
  value?: unknown;
}

export type SortDir = 'asc' | 'desc';

export interface Sort {
  field: string;
  fieldType: FieldType;
  dir: SortDir;
}

export const OPERATORS_FOR_TYPE: Record<FieldType, FilterOperator[]> = {
  text: ['contains', 'equals', 'not_equals', 'empty', 'not_empty'],
  number: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'empty', 'not_empty'],
  checkbox: ['is_checked', 'is_unchecked'],
  date: ['on', 'before', 'after', 'empty', 'not_empty'],
  select: ['equals', 'not_equals', 'empty', 'not_empty'],
};

const NO_VALUE_OPS = new Set<FilterOperator>([
  'empty',
  'not_empty',
  'is_checked',
  'is_unchecked',
]);

export function operatorsFor(type: FieldType): FilterOperator[] {
  return OPERATORS_FOR_TYPE[type];
}

export function needsValue(op: FilterOperator): boolean {
  return !NO_VALUE_OPS.has(op);
}

export function operatorLabel(op: FilterOperator): string {
  switch (op) {
    case 'empty':
      return 'is empty';
    case 'not_empty':
      return 'is not empty';
    case 'contains':
      return 'contains';
    case 'equals':
      return '=';
    case 'not_equals':
      return '≠';
    case 'eq':
      return '=';
    case 'neq':
      return '≠';
    case 'gt':
      return '>';
    case 'lt':
      return '<';
    case 'gte':
      return '≥';
    case 'lte':
      return '≤';
    case 'is_checked':
      return 'is checked';
    case 'is_unchecked':
      return 'is unchecked';
    case 'before':
      return 'before';
    case 'after':
      return 'after';
    case 'on':
      return 'on';
  }
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

function matches(entity: Entity, filter: Filter): boolean {
  const v = entity[filter.field];

  switch (filter.op) {
    case 'empty':
      return isEmpty(v);
    case 'not_empty':
      return !isEmpty(v);
    case 'is_checked':
      return !!v;
    case 'is_unchecked':
      return !v;

    case 'contains': {
      if (isEmpty(v)) return false;
      return String(v).toLowerCase().includes(String(filter.value ?? '').toLowerCase());
    }
    case 'equals': {
      if (isEmpty(v)) return isEmpty(filter.value);
      return String(v) === String(filter.value ?? '');
    }
    case 'not_equals': {
      // Empty values match neither `equals X` nor `not_equals X` (mirrors
      // Airtable and SQL three-valued logic). Use the explicit `empty`
      // op when you want them.
      if (isEmpty(v)) return false;
      return String(v) !== String(filter.value ?? '');
    }

    case 'eq':
    case 'neq':
    case 'gt':
    case 'lt':
    case 'gte':
    case 'lte': {
      if (isEmpty(v)) return false;
      const n = Number(v);
      const target = Number(filter.value);
      if (Number.isNaN(n) || Number.isNaN(target)) return false;
      if (filter.op === 'eq') return n === target;
      if (filter.op === 'neq') return n !== target;
      if (filter.op === 'gt') return n > target;
      if (filter.op === 'lt') return n < target;
      if (filter.op === 'gte') return n >= target;
      return n <= target;
    }

    case 'before':
    case 'after':
    case 'on': {
      if (isEmpty(v) || isEmpty(filter.value)) return false;
      const a = String(v);
      const b = String(filter.value);
      if (filter.op === 'before') return a < b;
      if (filter.op === 'after') return a > b;
      return a === b;
    }
  }
}

export function applyFilters(entities: Entity[], filters: Filter[]): Entity[] {
  if (filters.length === 0) return entities;
  return entities.filter((e) => filters.every((f) => matches(e, f)));
}

function compareValues(a: unknown, b: unknown, type: FieldType): number {
  const aEmpty = isEmpty(a);
  const bEmpty = isEmpty(b);
  // Empty values always sort to the end, regardless of direction.
  // applySort flips this when descending so empty is still last.
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (type === 'number') {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
    if (Number.isNaN(na)) return 1;
    if (Number.isNaN(nb)) return -1;
    return na - nb;
  }
  if (type === 'checkbox') {
    return (a ? 1 : 0) - (b ? 1 : 0);
  }
  // text / date / select all compare as strings; date is already
  // stored as ISO YYYY-MM-DD so lexicographic ordering is correct.
  return String(a).localeCompare(String(b));
}

export function applySort(entities: Entity[], sort: Sort | null): Entity[] {
  if (!sort) return entities;
  const dirMul = sort.dir === 'asc' ? 1 : -1;
  return [...entities].sort((x, y) => {
    const aEmpty = isEmpty(x[sort.field]);
    const bEmpty = isEmpty(y[sort.field]);
    // Pin empties to the end in both directions.
    if (aEmpty && !bEmpty) return 1;
    if (!aEmpty && bEmpty) return -1;
    return compareValues(x[sort.field], y[sort.field], sort.fieldType) * dirMul;
  });
}

export function defaultOperator(type: FieldType): FilterOperator {
  return OPERATORS_FOR_TYPE[type][0];
}

export function ensureFilterForType(filter: Filter, field: FieldSchema): Filter {
  const validOps = operatorsFor(field.type);
  if (validOps.includes(filter.op)) return { ...filter, fieldType: field.type };
  return { ...filter, fieldType: field.type, op: defaultOperator(field.type), value: undefined };
}
