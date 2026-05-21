/**
 * Shared helpers for link/linkedRecord/relationship field values.
 *
 * Link fields are stored in several shapes depending on origin:
 *   - Native arrays:       ["EVT-001", "EVT-002"]
 *   - Airtable ingestion:  { linked: ["at.appA.tblB.rec001", ...] }
 *   - Full target arrays:  ["at.appA.tblB.rec001", ...]
 *   - JSON-stringified:    '["EVT-001"]'
 *   - Single id string:    "EVT-001"
 *
 * `extractLinkIds` returns short record IDs (last segment of a target path)
 * so callers can compare uniformly against picker rows, regardless of which
 * shape currently lives in state.
 */

export function extractLinkIds(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string') {
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const p = JSON.parse(value);
        if (Array.isArray(p)) return normalizeArray(p);
      } catch { /* fall through to single-id path */ }
    }
    return value ? [toShortId(value)] : [];
  }
  if (Array.isArray(value)) return normalizeArray(value);
  if (typeof value === 'object') {
    const linked = (value as { linked?: unknown }).linked;
    if (Array.isArray(linked)) return normalizeArray(linked);
  }
  return [];
}

/**
 * Extract full target paths from a link-field value when present.
 * Returns the array of strings that contain a '.', so callers can
 * infer the linked table scope by stripping the final segment.
 */
export function extractLinkTargets(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.includes('.'));
  if (typeof value === 'object') {
    const linked = (value as { linked?: unknown }).linked;
    if (Array.isArray(linked)) return linked.filter((v): v is string => typeof v === 'string' && v.includes('.'));
  }
  return [];
}

function normalizeArray(arr: unknown[]): string[] {
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v === 'string') out.push(toShortId(v));
  }
  return out;
}

function toShortId(id: string): string {
  return id.includes('.') ? (id.split('.').pop() || id) : id;
}
