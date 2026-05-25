/**
 * Schema layer — read/write helpers on top of the foundation's defSchema.
 *
 * Schema lives in fold.state.schema under the path:
 *
 *   <entityType>.fields.<fieldName>.<property>
 *
 * Properties:
 *   - type    : 'text' | 'number' | 'checkbox' | 'date' | 'select'
 *   - options : string[]  (only for 'select')
 *   - order   : number    (column ordering)
 *
 * Schema is populated by DEF events with anchor:null whose path starts
 * with `_schema.`. The fold strips the `_schema.` prefix and stores the
 * rest under state.schema.
 */

import { defSchema } from './foundation/operators.js';
import type { FoldState } from './foundation/fold.js';

export type FieldType = 'text' | 'number' | 'checkbox' | 'date' | 'select';

export const FIELD_TYPES: FieldType[] = ['text', 'number', 'checkbox', 'date', 'select'];

export interface FieldSchema {
  name: string;
  type: FieldType;
  options?: string[];
  order: number;
}

export function getEntityTypeSchema(
  state: FoldState,
  entityType: string,
): Record<string, unknown> | null {
  const node = state.schema?.[entityType];
  if (!node || typeof node !== 'object') return null;
  return node as Record<string, unknown>;
}

export function getTypeFields(state: FoldState, entityType: string): FieldSchema[] {
  const typeNode = getEntityTypeSchema(state, entityType);
  if (!typeNode) return [];
  const fieldsNode = typeNode.fields;
  if (!fieldsNode || typeof fieldsNode !== 'object') return [];

  const fields: FieldSchema[] = [];
  for (const [name, raw] of Object.entries(fieldsNode as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const meta = raw as Record<string, unknown>;
    const type = isFieldType(meta.type) ? meta.type : 'text';
    const order = typeof meta.order === 'number' ? meta.order : 0;
    const options =
      type === 'select' && Array.isArray(meta.options)
        ? (meta.options as unknown[]).filter((o): o is string => typeof o === 'string')
        : undefined;
    fields.push({ name, type, order, options });
  }
  fields.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return fields;
}

export function getFieldSchema(
  state: FoldState,
  entityType: string,
  fieldName: string,
): FieldSchema | null {
  return getTypeFields(state, entityType).find((f) => f.name === fieldName) ?? null;
}

function isFieldType(value: unknown): value is FieldType {
  return typeof value === 'string' && (FIELD_TYPES as readonly string[]).includes(value);
}

/**
 * Add a new field to the schema. Idempotent — emitting the same field
 * twice just re-asserts the same DEF, which the fold absorbs without
 * incident.
 */
export async function addField(
  roomId: string,
  entityType: string,
  name: string,
  spec: { type: FieldType; options?: string[]; order?: number },
): Promise<void> {
  const safeName = name.trim();
  if (!safeName) throw new Error('Field name required');
  if (safeName.startsWith('_')) throw new Error('Field names cannot start with underscore');

  await defSchema(roomId, `${entityType}.fields.${safeName}.type`, spec.type);

  if (typeof spec.order === 'number') {
    await defSchema(roomId, `${entityType}.fields.${safeName}.order`, spec.order);
  }

  if (spec.type === 'select' && spec.options && spec.options.length > 0) {
    await defSchema(roomId, `${entityType}.fields.${safeName}.options`, spec.options);
  }
}

/**
 * Coerce a free-text input value into the appropriate JS shape for a
 * given field type. Used when committing a cell edit so the underlying
 * DEF carries a typed value (booleans round-trip as booleans, dates as
 * ISO strings, etc.) instead of always-strings.
 */
export function coerceValue(type: FieldType, raw: string): unknown {
  const trimmed = raw.trim();
  switch (type) {
    case 'number':
      if (trimmed === '') return null;
      return Number.isNaN(Number(trimmed)) ? trimmed : Number(trimmed);
    case 'checkbox':
      return trimmed === 'true' || trimmed === '1' || trimmed === 'on';
    case 'date':
      return trimmed === '' ? null : trimmed;
    case 'select':
      return trimmed === '' ? null : trimmed;
    case 'text':
    default:
      return raw;
  }
}

/**
 * How a value should appear when rendered as a cell — string for text /
 * number / date / select, '' for nullish, JSON for any unexpected shape.
 */
export function formatValue(type: FieldType, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (type === 'checkbox') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
