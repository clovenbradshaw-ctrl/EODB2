import type { EoEvent, Record_ } from './types';

/**
 * Apply a single EO event to a record map. Returns a new map (immutable fold).
 *
 * Operator semantics (minimum viable; will grow as features land):
 *
 *  - INS: instantiate the site. Merge resolution fields onto the record.
 *  - DEF: field-level write. Merge resolution fields. Functionally the
 *         same as INS at this level — the distinction matters for the
 *         per-field audit trail, which we'll add later.
 *  - DES: same merge (descriptions live in the resolution map).
 *  - NUL: mark the site as cleared. We keep the record around so cold-start
 *         hydration can see the tombstone, but drop the resolution body.
 *  - SEG/CON/SYN/EVA/REC: merge resolution. These have richer semantics in
 *         the full EO algebra but at this level we just preserve the
 *         payload — interpretation happens at the UI layer (and later in
 *         a richer fold).
 *
 * The materialized state is the *last writer wins* per site by `ts`. If two
 * events for the same site arrive out of order (e.g. backfill after live),
 * the one with the higher `ts` is canonical.
 */
export function applyEvent(state: Map<string, Record_>, ev: EoEvent): Map<string, Record_> {
  const site = ev.site;
  const next = new Map(state);
  const prev = next.get(site);

  // Older event arriving after a newer one — ignore for state, but the
  // event still belongs in the log (the caller is responsible for storing
  // events; this function only computes the materialized snapshot).
  if (prev && prev.last_ts > ev.ts) return state;

  if (ev.operator === 'NUL') {
    next.set(site, {
      site,
      resolution: {},
      cleared: true,
      last_event_id: ev.event_id,
      last_ts: ev.ts,
    });
    return next;
  }

  const base = prev && !prev.cleared ? prev.resolution : {};
  next.set(site, {
    site,
    resolution: { ...base, ...ev.resolution },
    last_event_id: ev.event_id,
    last_ts: ev.ts,
    cleared: false,
  });
  return next;
}

/** Fold a sequence of events into a record map. Pure; testable. */
export function fold(events: Iterable<EoEvent>): Map<string, Record_> {
  let state = new Map<string, Record_>();
  for (const ev of events) {
    state = applyEvent(state, ev);
  }
  return state;
}
