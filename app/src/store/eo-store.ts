import { create } from 'zustand';
import type { EoEvent, Record_ } from '../db/types';
import { EO_RECORD_TYPE } from '../db/types';
import { applyEvent } from '../db/fold';
import { loadCache, saveCache } from '../db/cache';
import {
  type Session,
  type MatrixTimelineEvent,
  sendEvent,
  getMessages,
  nextTxnId,
  MatrixError,
} from '../matrix/rest';

/** Debounce window for OPFS cache writes. Bursts of dispatches coalesce. */
const CACHE_DEBOUNCE_MS = 500;

let cacheTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleCacheWrite(get: () => { session: Session | null; roomId: string | null; events: Map<string, EoEvent> }) {
  if (cacheTimer) clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    cacheTimer = null;
    const { session, roomId, events } = get();
    if (!session || !roomId) return;
    void saveCache(
      { userId: session.userId, roomId, accessToken: session.accessToken },
      Array.from(events.values()),
    );
  }, CACHE_DEBOUNCE_MS);
}

/**
 * The single state slice — events, materialized snapshot, room/session,
 * and the dispatch + hydrate flow.
 *
 * Write path: optimistic → REST PUT → on ack stamp event_id; on failure
 * surface the error and leave the optimistic event in place (the user can
 * retry; we don't silently drop).
 *
 * Read path: paginate /messages backward from the room head, filter to
 * EO_RECORD_TYPE events, fold them into `records`.
 */

interface EoStore {
  session: Session | null;
  roomId: string | null;

  /** All EO events ever folded, by event_id (or pending key for optimistic). */
  events: Map<string, EoEvent>;
  /** Materialized snapshot derived from events. */
  records: Map<string, Record_>;

  /** Hydration progress. */
  hydrating: boolean;
  hydrateError: string | null;
  /** Whether the initial hydration has completed (true even if 0 events). */
  hydrated: boolean;

  setSession(s: Session | null): void;
  setRoom(roomId: string | null): void;

  /** Optimistically apply an event, then PUT it to Matrix. */
  dispatch(content: Omit<EoEvent, 'event_id' | 'pending' | 'origin_server_ts'>): Promise<void>;

  /** Read the OPFS cache (if any). Sets hydrated=true on a cache hit so
   * the UI paints instantly; hydrate() runs after to fill in fresh events. */
  loadFromCache(): Promise<boolean>;

  /** Cold-start hydration: paginate /messages → fold → done. */
  hydrate(): Promise<void>;

  /** Apply timeline events arriving from /sync. Idempotent by event_id. */
  applyRemote(events: MatrixTimelineEvent[]): void;

  /** Retry pending (un-acked) events. Safe to call repeatedly. */
  flushPending(): Promise<void>;

  /** Reset all in-memory state. Used on logout. */
  reset(): void;
}

export const useEoStore = create<EoStore>((set, get) => ({
  session: null,
  roomId: null,
  events: new Map(),
  records: new Map(),
  hydrating: false,
  hydrateError: null,
  hydrated: false,

  setSession(s) { set({ session: s }); },
  setRoom(roomId) { set({ roomId, hydrated: false, events: new Map(), records: new Map() }); },

  async dispatch(content) {
    const { session, roomId } = get();
    if (!session || !roomId) throw new Error('Not signed in to a room');

    // 1. Optimistic local apply. The pending event carries a stable
    //    txn_id so a retry (after reload, after reconnect) re-PUTs with
    //    the same id — Matrix dedups server-side and returns the
    //    existing event_id instead of creating a duplicate.
    const txn_id = nextTxnId();
    const pendingKey = '$pending:' + txn_id;
    const optimistic: EoEvent = { ...content, event_id: pendingKey, pending: true, txn_id };
    const events = new Map(get().events);
    events.set(pendingKey, optimistic);
    const records = applyEvent(get().records, optimistic);
    set({ events, records });
    // Persist the pending event immediately so it survives a reload.
    scheduleCacheWrite(get);

    // 2. Matrix PUT. On success, swap the pending key for the real id.
    //    On failure, leave the pending event in place; flushPending()
    //    will retry on /sync resume, on the `online` event, and on
    //    a periodic tick.
    try {
      const { event_id } = await sendEvent(
        session,
        roomId,
        EO_RECORD_TYPE,
        {
          operator: content.operator,
          site: content.site,
          resolution: content.resolution,
          ts: content.ts,
          agent: content.agent,
          ...(content.seq !== undefined ? { seq: content.seq } : {}),
        },
        txn_id,
      );
      const events2 = new Map(get().events);
      events2.delete(pendingKey);
      const settled: EoEvent = { ...content, event_id };
      events2.set(event_id, settled);
      const records2 = applyEvent(get().records, settled);
      set({ events: events2, records: records2 });
      scheduleCacheWrite(get);
    } catch (e) {
      console.warn('[eo-store] dispatch failed (will retry):', e);
    }
  },

  async flushPending() {
    const { session, roomId, events } = get();
    if (!session || !roomId) return;
    // Snapshot the pending list so concurrent dispatches don't trip us.
    const pendings = Array.from(events.values()).filter((e) => e.pending && e.txn_id);
    for (const p of pendings) {
      try {
        const { event_id } = await sendEvent(
          session,
          roomId,
          EO_RECORD_TYPE,
          {
            operator: p.operator,
            site: p.site,
            resolution: p.resolution,
            ts: p.ts,
            agent: p.agent,
            ...(p.seq !== undefined ? { seq: p.seq } : {}),
          },
          p.txn_id!,
        );
        const cur = get().events;
        if (!cur.has(p.event_id!)) continue; // user cleared it meanwhile
        const events2 = new Map(cur);
        events2.delete(p.event_id!);
        const settled: EoEvent = {
          operator: p.operator, site: p.site, resolution: p.resolution,
          ts: p.ts, agent: p.agent, event_id,
          ...(p.seq !== undefined ? { seq: p.seq } : {}),
        };
        events2.set(event_id, settled);
        const records2 = applyEvent(get().records, settled);
        set({ events: events2, records: records2 });
        scheduleCacheWrite(get);
      } catch {
        // Server still unreachable. Stop here — next tick will try again.
        return;
      }
    }
  },

  async loadFromCache() {
    const { session, roomId } = get();
    if (!session || !roomId) return false;
    const cached = await loadCache({
      userId: session.userId,
      roomId,
      accessToken: session.accessToken,
    });
    if (!cached) return false;
    const combined = [...cached.acked, ...cached.pending];
    if (combined.length === 0) return false;
    // Sort ascending so the fold sees them in causal order.
    combined.sort((a, b) => a.ts - b.ts);
    const events = new Map<string, EoEvent>();
    let records = new Map<string, Record_>();
    for (const ev of combined) {
      if (ev.event_id) events.set(ev.event_id, ev);
      records = applyEvent(records, ev);
    }
    set({ events, records, hydrated: true });
    return true;
  },

  async hydrate() {
    const { session, roomId } = get();
    if (!session || !roomId) return;
    if (get().hydrating) return;
    set({ hydrating: true, hydrateError: null });

    try {
      let from: string | undefined = undefined;
      let pages = 0;
      const seenSites = new Set<string>();
      const all: EoEvent[] = [];
      while (pages < 50) {
        const page = await getMessages(session, roomId, { dir: 'b', limit: 100, from });
        for (const ev of page.chunk) {
          if (ev.type !== EO_RECORD_TYPE) continue;
          const c = ev.content;
          if (!c || typeof c.site !== 'string') continue;
          all.push({
            operator: c.operator,
            site: c.site,
            resolution: c.resolution ?? {},
            ts: typeof c.ts === 'number' ? c.ts : ev.origin_server_ts,
            agent: c.agent ?? ev.sender,
            event_id: ev.event_id,
            origin_server_ts: ev.origin_server_ts,
            ...(typeof c.seq === 'number' ? { seq: c.seq } : {}),
          });
          seenSites.add(c.site);
        }
        pages++;
        if (!page.end || page.chunk.length === 0) break;
        from = page.end;
      }
      // Merge with anything already loaded (e.g. from OPFS cache). Sort
      // the combined set ascending by ts so the fold sees causal order.
      const events = new Map(get().events);
      for (const ev of all) {
        if (ev.event_id && !events.has(ev.event_id)) events.set(ev.event_id, ev);
      }
      const merged = Array.from(events.values()).sort((a, b) => a.ts - b.ts);
      let records = new Map<string, Record_>();
      for (const ev of merged) records = applyEvent(records, ev);
      set({ events, records, hydrating: false, hydrated: true });
      scheduleCacheWrite(get);
    } catch (e: any) {
      const msg = e instanceof MatrixError ? `${e.status} ${e.message}` : String(e?.message ?? e);
      set({ hydrating: false, hydrateError: msg });
    }
  },

  applyRemote(timeline) {
    let events = get().events;
    let records = get().records;
    let changed = false;
    for (const tl of timeline) {
      if (tl.type !== EO_RECORD_TYPE) continue;
      if (!tl.event_id || events.has(tl.event_id)) continue;
      const c = tl.content;
      if (!c || typeof c.site !== 'string') continue;
      const ev: EoEvent = {
        operator: c.operator,
        site: c.site,
        resolution: c.resolution ?? {},
        ts: typeof c.ts === 'number' ? c.ts : tl.origin_server_ts,
        agent: c.agent ?? tl.sender,
        event_id: tl.event_id,
        origin_server_ts: tl.origin_server_ts,
        ...(typeof c.seq === 'number' ? { seq: c.seq } : {}),
      };
      if (!changed) { events = new Map(events); }
      events.set(tl.event_id, ev);
      records = applyEvent(records, ev);
      changed = true;
    }
    if (changed) {
      set({ events, records });
      scheduleCacheWrite(get);
    }
  },

  reset() {
    set({
      session: null,
      roomId: null,
      events: new Map(),
      records: new Map(),
      hydrating: false,
      hydrateError: null,
      hydrated: false,
    });
  },
}));
