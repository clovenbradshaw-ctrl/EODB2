import type { MatrixClient } from 'matrix-js-sdk';

export type OutboxStatus = 'pending' | 'inflight' | 'sent' | 'dead';

export interface OutboxRecord {
  localId: string;
  roomId: string;
  eventType: string;
  content: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  createdAt: number;
  nextAttemptAt: number;
  sentEventId: string | null;
  lastError: string | null;
  _undecryptable?: boolean;
}

export function enqueue(args: {
  roomId: string;
  eventType: string;
  content: Record<string, unknown>;
}): Promise<OutboxRecord>;

export function listAll(): Promise<OutboxRecord[]>;
export function pendingCount(): Promise<number>;
export function getByLocalId(localId: string): Promise<OutboxRecord | null>;
export function markInflight(localId: string): Promise<OutboxRecord | null>;
export function markSent(localId: string, sentEventId: string): Promise<OutboxRecord | null>;
export function markFailed(
  localId: string,
  error: unknown,
  attempts: number,
): Promise<OutboxRecord | null>;
export function markDead(localId: string, error: unknown): Promise<OutboxRecord | null>;
export function remove(localId: string): Promise<void>;
export function purgeSent(): Promise<void>;
export function clearAll(): Promise<void>;
export function onChange(fn: () => void): () => void;

export type FlusherAckEvent = {
  localId: string;
  eventId: string;
  roomId: string;
};

export type FlusherProgressEvent =
  | { type: 'hoisted'; localId: string; count: number }
  | { type: 'sent'; localId: string; eventId: string }
  | { type: 'retry'; localId: string; attempts: number; tooLarge: boolean; error: string }
  | { type: 'dead'; localId: string; error: string };

export class OutboxFlusher {
  constructor(args: {
    getClient: () => MatrixClient | null;
    onAck?: (event: FlusherAckEvent) => void;
    onProgress?: (event: FlusherProgressEvent) => void;
  });
  start(): void;
  stop(): void;
  kick(): Promise<void>;
}
