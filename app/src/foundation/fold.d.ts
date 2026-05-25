export interface Entity {
  _anchor: string;
  _type: string;
  _created: number;
  _sender?: string | null;
  _eventId?: string | null;
  _hwm: number;
  _partition?: string;
  _updated?: number;
  _updatedBy?: string | null;
  _evaluations?: Array<{
    criterion: string;
    result: string;
    note?: string;
    _ts: number;
    _sender?: string | null;
  }>;
  [field: string]: unknown;
}

export interface Connection {
  source: string;
  target: string;
  type: string;
  _ts: number;
  _sender?: string | null;
  _eventId?: string | null;
}

export interface Frame {
  scope?: string;
  before_frame?: unknown;
  after_frame?: unknown;
  _ts: number;
  _sender?: string | null;
  [k: string]: unknown;
}

export interface FoldState {
  entities: Record<string, Entity>;
  partitions: Record<string, string>;
  connections: Connection[];
  frames: Frame[];
  schema: Record<string, unknown>;
  cursor: number;
  _undecryptable: number;
  _violations: Array<Record<string, unknown>>;
  _stateHash?: string;
}

export function initial(): FoldState;
export function fold(events: unknown[]): FoldState;
export function foldFrom(state: FoldState, newEvents: unknown[]): FoldState;
export function entitiesOfType(state: FoldState, entityType: string): Entity[];
export function entitiesInPartition(state: FoldState, partition: string): Entity[];
export function connectionsFor(state: FoldState, anchor: string): Connection[];
export function currentFrame(state: FoldState): Frame | null;
export function causalPartition(state: FoldState, anchor: string): Set<string>;
export function stateHash(state: FoldState): number;
export function cyrb53(str: string, seed?: number): number;
