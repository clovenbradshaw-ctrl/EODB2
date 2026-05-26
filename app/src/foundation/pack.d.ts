export const HEADER_SIZE: number;

export function packEvent(
  opOrder: number,
  ts: number,
  eventId: string,
  sender: string,
  content: unknown,
): Uint8Array;
export function packBatch(
  events: Array<{
    opOrder: number;
    ts: number;
    eventId: string;
    sender: string;
    content: unknown;
  }>,
): Uint8Array;
export function unpackAll(data: Uint8Array, namespace: string): unknown[];
export function unpackSince(
  data: Uint8Array,
  namespace: string,
  sinceTs: number,
): unknown[];
export function scanMeta(data: Uint8Array): {
  count: number;
  firstTs: number;
  lastTs: number;
  byOp: number[];
};
export function fnv1a32(str: string): number;
export function fnv1a64(str: string): [number, number];
