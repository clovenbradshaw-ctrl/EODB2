/**
 * Crash-recovery wipe.
 *
 * If a sync (Airtable, peer, etc.) writes more data into OPFS than the device
 * can fit into a single in-memory snapshot, every subsequent page load tries
 * to re-load the same oversized state and crashes before any UI is reachable.
 * The user is locked out of the very settings panel that would let them clear
 * the cache.
 *
 * `resetLocalStorage()` is the escape hatch: it nukes the on-disk state that
 * the boot path tries to load, without ever instantiating React or touching
 * the fold worker. It is invoked pre-render from `main.tsx` when the URL
 * hash matches `#/reset-storage`.
 *
 * Scope:
 *   - OPFS root, recursively: every `space.<id>/` subdir plus any top-level
 *     log/snapshot/checkpoint files used by local-mode.
 *   - Matrix crypto IndexedDB databases: stale device-id state that survives
 *     OPFS wipes would otherwise cause login failures on the next session.
 *
 * Out of scope (intentional):
 *   - localStorage: holds the OAuth refresh token, theme, the
 *     `eo-selected-space` pointer. None of these can be 500 MB and removing
 *     them logs the user out unnecessarily.
 *   - The encrypted-store IndexedDB databases. These hold per-space metadata
 *     that's small (cursors, sync log, hydration checkpoint). Leaving them
 *     intact is fine because the OPFS wipe drops the events those metas
 *     describe — on the next run, the metas point to a fresh empty log and
 *     a re-sync re-derives them.
 */

import {
  clearOpfsSpaceDirs,
  clearOpfsRootFiles,
  deleteMatrixCryptoDbs,
} from './session-lifecycle';

const OPFS_FILES_TO_REMOVE = [
  // Local-mode (no spaceId) writes these directly under the OPFS root.
  // Worker-managed; safe to delete while no worker is running.
  'eodb.idx',
  'eodb.pay',
  'log.bin',
  'kv-snapshot.bin',
  'kv-snapshot.tmp',
  'fold-position.bin',
  'init-cache.bin',
];

export interface ResetReport {
  spacesRemoved: number;
  rootFilesRemoved: number;
  cryptoDbsRemoved: number;
  errors: string[];
}

export async function resetLocalStorage(): Promise<ResetReport> {
  // OPFS space dirs, OPFS root local-mode files, and the Matrix crypto IDB
  // are all purged via the shared primitives in lib/session-lifecycle.ts —
  // the same code logout uses, so the two paths can no longer drift apart.
  // localStorage is intentionally left intact (see the module comment): the
  // reset escape hatch must not log the user out.
  const [spacesRemoved, rootFilesRemoved, cryptoDbsRemoved] = await Promise.all([
    clearOpfsSpaceDirs(),
    clearOpfsRootFiles(OPFS_FILES_TO_REMOVE),
    deleteMatrixCryptoDbs(),
  ]);

  return { spacesRemoved, rootFilesRemoved, cryptoDbsRemoved, errors: [] };
}

/**
 * The hash that triggers `resetLocalStorage()` in `main.tsx`. Defined here
 * so the route shape lives next to the implementation it gates.
 */
export const RESET_STORAGE_HASH = '#/reset-storage';
