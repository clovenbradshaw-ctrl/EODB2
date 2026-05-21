/**
 * Room-level stats published as a Matrix state event.
 *
 * Carries `totalEvents` (current EO log head seq) and `lastEventTs`
 * (newest event's wall-clock time). State events are unencrypted, tiny,
 * and replicated to every member automatically — perfect for "is my
 * local store complete?" checks on boot without re-walking the timeline.
 *
 * Writers: a debounced hook on every dispatched EO event, plus an
 * explicit flush after Airtable sync completes.
 *
 * Readers: the init / setupSpaceStore path uses it to decide whether to
 * trigger a full block-chain hydrate (cold local vs. fresh local) and
 * as the denominator for an "X of Y events" progress indicator.
 *
 * No record content is ever placed in this event — just counts and
 * timestamps. Totals are operational metadata, not user data.
 */

import type { MatrixClient } from 'matrix-js-sdk';

export const EO_STATS_TYPE = 'com.eo-db.stats';

export interface RoomStats {
  /** Monotonic event seq head, equals the latest event's `seq` field. */
  totalEvents: number;
  /** Unix ms — newest folded event's wall-clock origin time. */
  lastEventTs: number;
  /** Unix ms when this state event was written. */
  updatedAt: number;
  /** Matrix user id that wrote this stats event. */
  updatedBy: string;
}

/**
 * Read the current stats from room state. Returns `null` when the room
 * has never published a stats event yet (cold start / pre-feature
 * deployment) — callers should treat that as "unknown total".
 */
export function readRoomStats(
  client: MatrixClient,
  roomId: string,
): RoomStats | null {
  const room = client.getRoom(roomId);
  if (!room) return null;
  const ev = room.currentState?.getStateEvents?.(EO_STATS_TYPE, '');
  if (!ev) return null;
  const content = ev.getContent() as Partial<RoomStats> | undefined;
  if (
    !content ||
    typeof content.totalEvents !== 'number' ||
    typeof content.lastEventTs !== 'number' ||
    typeof content.updatedAt !== 'number' ||
    typeof content.updatedBy !== 'string'
  ) {
    return null;
  }
  return content as RoomStats;
}

/**
 * Publish a new stats event. State events overwrite by `(type, stateKey)`,
 * so there is exactly one stats event per room at any time.
 *
 * Callers should debounce — Matrix homeservers rate-limit state writes
 * and a per-event burst would melt under a large Airtable import.
 */
export async function writeRoomStats(
  client: MatrixClient,
  roomId: string,
  stats: RoomStats,
): Promise<void> {
  await client.sendStateEvent(roomId, EO_STATS_TYPE as any, stats, '');
}
