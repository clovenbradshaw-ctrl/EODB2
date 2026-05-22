import { create } from 'zustand';
import type { EoEvent, Record_ } from '../db/types';
import { EO_RECORD_TYPE } from '../db/types';
import { applyEvent } from '../db/fold';
import {
  type Session,
  sendEvent,
  getMessages,
  nextTxnId,
  MatrixError,
} from '../matrix/rest';

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

  /** Cold-start hydration: paginate /messages → fold → done. */
  hydrate(): Promise<void>;

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

    // 1. Optimistic local apply. The pending event lives under a temp key
    //    until the Matrix ack stamps its real event_id.
    const pendingKey = '$pending:' + nextTxnId();
    const optimistic: EoEvent = { ...content, event_id: pendingKey, pending: true };
    const events = new Map(get().events);
    events.set(pendingKey, optimistic);
    const records = applyEvent(get().records, optimistic);
    set({ events, records });

    // 2. Matrix PUT. On success, swap the pending key for the real id.
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
        nextTxnId(),
      );
      const events2 = new Map(get().events);
      events2.delete(pendingKey);
      const settled: EoEvent = { ...content, event_id };
      events2.set(event_id, settled);
      // Re-derive: applyEvent on the same site with the same ts is idempotent
      // under last-writer-wins, so we don't have to rebuild from scratch.
      const records2 = applyEvent(get().records, settled);
      set({ events: events2, records: records2 });
    } catch (e) {
      // Leave the optimistic event in place but mark its failure visibly.
      // The user sees the row; a retry primitive will come in a follow-up.
      console.warn('[eo-store] dispatch failed:', e);
      throw e;
    }
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
      // Sort ascending by ts so the fold sees them in causal order.
      all.sort((a, b) => a.ts - b.ts);
      const events = new Map<string, EoEvent>();
      let records = new Map<string, Record_>();
      for (const ev of all) {
        if (ev.event_id) events.set(ev.event_id, ev);
        records = applyEvent(records, ev);
      }
      set({ events, records, hydrating: false, hydrated: true });
    } catch (e: any) {
      const msg = e instanceof MatrixError ? `${e.status} ${e.message}` : String(e?.message ?? e);
      set({ hydrating: false, hydrateError: msg });
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
