/**
 * Durable offline event queue.
 *
 * Matrix room events are the source of truth: a locally-dispatched edit is
 * not part of the canonical, auditable record until it reaches the room
 * timeline. When the homeserver is unreachable the event is parked here —
 * in IndexedDB, so it survives reloads — and retried on every reconnect.
 *
 * A transient send failure NEVER drops an event: it is retried with no
 * attempt cap, because an un-delivered edit is real data the user made.
 * The queue is keyed by room id so each space's pending writes are
 * independent.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { EoEvent } from '../db/types';

const DB_NAME = 'eo-offline-queue';
const STORE = 'queue';
const DB_VERSION = 1;

interface QueueEntry {
  event: EoEvent;
  /** Send attempts so far — kept for diagnostics; never causes a drop. */
  attempts: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

// All queue mutations run through one chain so a concurrent enqueue and
// flush cannot read-modify-write over each other.
let opChain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = opChain.then(fn, fn);
  opChain = run.catch(() => {});
  return run;
}

/** Park an event that could not be delivered to its room's timeline. */
export function enqueueOfflineEvent(roomId: string, event: EoEvent): Promise<void> {
  return serial(async () => {
    const db = await getDb();
    const queue: QueueEntry[] = (await db.get(STORE, roomId)) ?? [];
    queue.push({ event, attempts: 0 });
    await db.put(STORE, queue, roomId);
  });
}

export interface FlushResult {
  sent: number;
  remaining: number;
}

/**
 * Flush a room's queued events through `send`, in order. An event leaves
 * the queue only once `send` resolves. Anything that still fails stays
 * queued — with no attempt cap — for the next reconnect. Never throws.
 */
export function flushOfflineQueue(
  roomId: string,
  send: (event: EoEvent) => Promise<void>,
): Promise<FlushResult> {
  return serial(async () => {
    const db = await getDb();
    const queue: QueueEntry[] = (await db.get(STORE, roomId)) ?? [];
    if (queue.length === 0) return { sent: 0, remaining: 0 };

    const remaining: QueueEntry[] = [];
    let sent = 0;
    for (const entry of queue) {
      try {
        await send(entry.event);
        sent++;
      } catch {
        // Still undeliverable — keep it; the edit is real and must not be
        // lost. Retried on the next reconnect.
        remaining.push({ event: entry.event, attempts: entry.attempts + 1 });
      }
    }
    await db.put(STORE, remaining, roomId);
    return { sent, remaining: remaining.length };
  });
}

/** Number of events still waiting to reach the given room's timeline. */
export function offlineQueueDepth(roomId: string): Promise<number> {
  return serial(async () => {
    const db = await getDb();
    const queue: QueueEntry[] = (await db.get(STORE, roomId)) ?? [];
    return queue.length;
  });
}

/**
 * Delete the entire offline-queue database. Called on logout so queued
 * writes from a prior session are not replayed under a new account.
 * Best-effort — never rejects.
 */
export function eraseOfflineQueue(): Promise<void> {
  return serial(async () => {
    // Drop the cached connection first so the delete is not blocked.
    if (dbPromise) {
      try { (await dbPromise).close(); } catch { /* ignore */ }
      dbPromise = null;
    }
    await new Promise<void>((resolve) => {
      try {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      } catch {
        resolve();
      }
    });
  });
}
