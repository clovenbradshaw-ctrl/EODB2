/**
 * EO event model. Mirrors the sanity check exactly.
 *
 * An event occurs at a `site` (a dotted path like "tblClients.rec123" or
 * "case:12345") with an `operator` describing what happened and a
 * `resolution` describing how it resolved. The fold reduces a sequence of
 * events to a current `Record` per site.
 */

export const EO_RECORD_TYPE = 'eo.db.record';
export const EO_MEDIA_TYPE = 'eo.db.media';

/** EO operators, per the sanity check's select options. */
export type Operator =
  | 'INS' // instantiation — site exists
  | 'DES' // description
  | 'NUL' // null / cleared
  | 'SEG' // segmentation
  | 'CON' // connection / join
  | 'SYN' // synthesis
  | 'DEF' // definition (field-level write)
  | 'EVA' // evaluation
  | 'REC' // recursion
  ;

export const OPERATORS: Operator[] = ['INS', 'DES', 'NUL', 'SEG', 'CON', 'SYN', 'DEF', 'EVA', 'REC'];

/** The shape we PUT into Matrix as the event content. */
export interface EoEventContent {
  operator: Operator;
  site: string;
  resolution: Record<string, any>;
  ts: number;
  agent: string;
  /** Monotonic per-author sequence. Optional; not load-bearing. */
  seq?: number;
}

/** An EO event after it has landed in (or been read back from) Matrix. */
export interface EoEvent extends EoEventContent {
  /** Matrix event_id, populated on ack / read. Pending events have no id. */
  event_id?: string;
  /** Matrix room timeline ts. May differ from `ts` (client clock). */
  origin_server_ts?: number;
  /** Local optimistic state: true until the Matrix PUT ack lands. */
  pending?: boolean;
  /**
   * Per-device Matrix txn id, set on pending events so a retry can re-PUT
   * with the same txn id — Matrix dedups by (sender, txn_id) and will
   * return the existing event_id instead of creating a duplicate.
   */
  txn_id?: string;
}

/** A media event references an mxc:// URI with integrity metadata. */
export interface EoMediaContent extends EoEventContent {
  resolution: {
    mxc_uri: string;
    sha256: string;
    size: number;
    filename?: string;
    content_type?: string;
    uploaded_at?: number;
    [k: string]: any;
  };
}

/**
 * The materialized state at a single site, produced by folding events.
 * Sites with only NUL events are absent from the snapshot; INS/DEF/etc.
 * build up `resolution`.
 */
export interface Record_ {
  site: string;
  resolution: Record<string, any>;
  /** Last event_id that touched this site. */
  last_event_id?: string;
  /** Last ts that touched this site. */
  last_ts: number;
  /** True if the latest operator was NUL (site exists but is cleared). */
  cleared?: boolean;
}
