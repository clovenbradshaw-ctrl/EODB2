/**
 * Phase 2 — the session lifecycle.
 *
 * Before this, "sign out" was a ~25-line imperative sequence inlined in
 * `Layout.handleLogout`, and the OPFS / crypto-IDB half of it was mirrored
 * a second time in `reset-storage.ts` with a comment begging the two copies
 * to be kept in sync. Several account-scoped localStorage keys
 * (`eo-selected-space`, `eo-active-user-type`, `eo-spaces`, the per-room
 * `eo-db-auto-ingest:` toggles) were never purged at all, so a second
 * account signing in on the same browser inherited the first account's
 * space pointer, persona, and ingest settings.
 *
 * This module is the single owner of two things:
 *
 *   1. `SessionPhase` — the lifecycle state machine. `handleLogout` had no
 *      re-entrancy guard, so a double-click (or an auto-logout racing a
 *      manual one) ran the whole teardown twice. The phase is the latch.
 *
 *   2. `purgeAccountStorage()` — the one exhaustive purge of everything
 *      account-scoped. It has no heavy imports, so `reset-storage.ts` can
 *      share its OPFS / crypto-IDB primitives instead of duplicating them.
 */

// ─── Lifecycle state machine ─────────────────────────────────────────────────

/**
 * Where a session is in its lifecycle.
 *
 *   active     — signed in, token believed valid.
 *   expired    — the homeserver rejected the token (401 / M_UNKNOWN_TOKEN);
 *                local state can no longer be trusted to round-trip.
 *   purging    — teardown + storage wipe in progress.
 *   signed-out — purge complete; the app should be back at the login screen.
 */
export type SessionPhase = 'active' | 'expired' | 'purging' | 'signed-out';

const TRANSITIONS: Record<SessionPhase, readonly SessionPhase[]> = {
  active: ['expired', 'purging'],
  expired: ['purging'],
  purging: ['signed-out'],
  'signed-out': [],
};

/** True if `from → to` is a legal session transition. */
export function canTransitionSession(from: SessionPhase, to: SessionPhase): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * True once a logout/purge has begun. Callers use this to make the logout
 * handler idempotent — a second click, or an auto-logout firing while a
 * manual one is already running, is a no-op.
 */
export function isTerminalSessionPhase(phase: SessionPhase): boolean {
  return phase === 'purging' || phase === 'signed-out';
}

// ─── Storage manifest ────────────────────────────────────────────────────────
//
// The authoritative list of what "account-scoped" means. Anything here is
// wiped on logout; anything NOT here survives so the next login keeps the
// user's device-level preferences.

/** Exact localStorage keys cleared on logout. */
const ACCOUNT_LS_KEYS = [
  'eo-db-session',        // matrix/client SESSION_KEY
  'eo-db-device-id',      // matrix/client DEVICE_ID_KEY
  'eo-selected-space',    // last-opened space pointer
  'eo-active-user-type',  // persona selection (eo-store)
  'eo-local-mode',        // local-only mode flag
  'eo.sync.mode',         // operator/peer sync mode
  'eo-spaces',            // cached space-root list
] as const;

/**
 * localStorage key PREFIXES cleared on logout. Mirrors of the canonical
 * prefixes in db/space-meta.ts (`eo-spacemeta:`), sync/block-hydration.ts
 * (`eo-db-hydrated-head:`, `eo-db-auto-ingest:`). They are repeated here
 * deliberately: this module is the purge manifest of record, and importing
 * those modules would drag their (heavy) dependency graphs into the
 * crash-recovery path that also consumes this file.
 */
const ACCOUNT_LS_PREFIXES = [
  'eo-spacemeta:',
  'eo-db-hydrated-head:',
  'eo-db-auto-ingest:',
] as const;

/**
 * Preserved across logout — device-level UI preferences, not account data.
 * Listed only for documentation; the purge is allow-list-free (it removes
 * exactly the keys/prefixes above), so a new preference key is preserved by
 * default. Keeps the surprising direction safe: forgetting to list a key
 * leaks nothing, it just survives.
 */
export const PRESERVED_LS_KEYS = ['eo-theme', 'eo:detailsPanelCollapsed'] as const;

/** Offline-queue IndexedDB name (mirror of sync-manager's IDB_QUEUE_NAME). */
const OFFLINE_QUEUE_DB = 'eo-offline-queue';

// ─── Primitives ──────────────────────────────────────────────────────────────

/** Delete an IndexedDB database by name. Best-effort — never rejects. */
function deleteIdb(name: string): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      // Blocked means another tab still holds the DB open — resolve anyway
      // so logout never hangs on it.
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Delete the Matrix SDK crypto IndexedDB stores (Rust crypto, Olm sessions).
 * A stale crypto store causes device-ID mismatches on the next login because
 * the new session gets a fresh device ID while the old store references the
 * previous one. Best-effort.
 */
export async function deleteMatrixCryptoDbs(): Promise<number> {
  let removed = 0;
  try {
    const dbs = await indexedDB.databases();
    const targets = dbs
      .map((d) => d.name)
      .filter(
        (n): n is string =>
          typeof n === 'string' &&
          (n.includes('matrix') || n.includes('rust-crypto')),
      );
    await Promise.all(
      targets.map(async (name) => {
        await deleteIdb(name);
        removed++;
      }),
    );
  } catch {
    /* best-effort */
  }
  return removed;
}

/**
 * Remove every `space.*` directory from the OPFS root. These hold a space's
 * event log, snapshots, and checkpoints — stale content that must not
 * persist across a sign-out or account switch. Returns the count removed.
 */
export async function clearOpfsSpaceDirs(): Promise<number> {
  let removed = 0;
  try {
    const root = await navigator.storage.getDirectory();
    const entries: AsyncIterable<[string, FileSystemHandle]> = (
      root as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }
    ).entries();
    for await (const [name] of entries) {
      if (typeof name === 'string' && name.startsWith('space.')) {
        await root.removeEntry(name, { recursive: true }).catch(() => {});
        removed++;
      }
    }
  } catch {
    /* best-effort */
  }
  return removed;
}

/** Remove the listed files from the OPFS root (local-mode log artifacts). */
export async function clearOpfsRootFiles(names: readonly string[]): Promise<number> {
  let removed = 0;
  try {
    const root = await navigator.storage.getDirectory();
    for (const name of names) {
      try {
        await root.removeEntry(name, { recursive: true });
        removed++;
      } catch {
        /* file absent or locked — best-effort */
      }
    }
  } catch {
    /* best-effort */
  }
  return removed;
}

/** Remove all account-scoped localStorage keys, preserving device prefs. */
export function clearAccountLocalStorage(): void {
  try {
    for (const key of ACCOUNT_LS_KEYS) {
      localStorage.removeItem(key);
    }
    // Prefix sweep — collect first, then delete, so the live index isn't
    // mutated mid-iteration.
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && ACCOUNT_LS_PREFIXES.some((p) => k.startsWith(p))) {
        drop.push(k);
      }
    }
    for (const k of drop) localStorage.removeItem(k);
  } catch {
    /* quota / disabled storage — best-effort */
  }
}

// ─── Full purge ──────────────────────────────────────────────────────────────

export interface PurgeReport {
  spaceDirsRemoved: number;
  cryptoDbsRemoved: number;
}

/**
 * The single, exhaustive purge of everything account-scoped: localStorage
 * keys, OPFS space directories, the Matrix crypto IndexedDB stores, and the
 * offline-queue IndexedDB.
 *
 * This is the only thing `Layout.handleLogout` needs for the storage half of
 * a sign-out — in-memory teardown (workers, the eo-store) stays in the
 * component because it owns those handles. Every step is best-effort: a
 * failure in one does not abort the rest, because a partial purge that
 * leaves the user signed out is safer than a hang that leaves them stuck.
 */
export async function purgeAccountStorage(): Promise<PurgeReport> {
  clearAccountLocalStorage();
  const [spaceDirsRemoved, cryptoDbsRemoved] = await Promise.all([
    clearOpfsSpaceDirs(),
    deleteMatrixCryptoDbs(),
    deleteIdb(OFFLINE_QUEUE_DB),
  ]);
  return { spaceDirsRemoved, cryptoDbsRemoved };
}
