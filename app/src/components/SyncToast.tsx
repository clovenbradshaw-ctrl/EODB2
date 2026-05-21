/**
 * SyncToast — brief confirmation when events sync to Matrix (or fail to).
 *
 * A single pill at the bottom of the screen, auto-dismissed after a few
 * seconds. Driven by a module-level notifier so any layer (PeerSync,
 * Airtable, hydration, ...) can publish a status without prop-drilling.
 *
 * Aggregation: 'confirmed' calls are throttled and counted. A burst of
 * edits produces a single "Synced to Matrix (12)" pill rather than 12
 * separate toasts — important for bulk operations.
 */

import { useEffect, useState } from 'react';
import { useTheme } from '../theme';

export type SyncToastStatus = 'confirmed' | 'queued' | 'rate-limited' | 'info';

interface ToastEntry {
  status: SyncToastStatus;
  label: string;
  /** Monotonic counter — bumped on every publish so a repeat status still
   *  re-triggers the React effect. */
  seq: number;
}

const DISPLAY_MS = 2500;
const CONFIRM_THROTTLE_MS = 2500;

let currentEntry: ToastEntry | null = null;
let nextSeq = 0;
const listeners = new Set<(entry: ToastEntry | null) => void>();

function emit(next: ToastEntry | null): void {
  currentEntry = next;
  for (const l of listeners) l(next);
}

function publish(status: SyncToastStatus, label: string): void {
  nextSeq += 1;
  emit({ status, label, seq: nextSeq });
}

// ── Confirmed aggregation ────────────────────────────────────────────────────
// Throttle: the first 'confirmed' in a quiet period fires immediately so the
// user sees instant feedback. Subsequent confirms within the window are
// accumulated; at the end of the window we emit one toast with the count and
// re-arm if more arrived. Continuous bulk activity (e.g. Airtable hydration)
// therefore produces ~one pill every CONFIRM_THROTTLE_MS rather than one per
// event.
let pendingConfirms = 0;
let throttleActive = false;

function flushConfirms(): void {
  if (pendingConfirms === 0) {
    throttleActive = false;
    return;
  }
  const count = pendingConfirms;
  pendingConfirms = 0;
  publish(
    'confirmed',
    count > 1 ? `Synced to Matrix (${count})` : 'Synced to Matrix',
  );
  setTimeout(flushConfirms, CONFIRM_THROTTLE_MS);
}

function notifyConfirmed(): void {
  if (!throttleActive) {
    pendingConfirms = 0;
    throttleActive = true;
    publish('confirmed', 'Synced to Matrix');
    setTimeout(flushConfirms, CONFIRM_THROTTLE_MS);
    return;
  }
  pendingConfirms += 1;
}

/**
 * Module-level notifier — call from anywhere (PeerSync, Airtable, etc.)
 * without prop-drilling React state.
 */
export const notifySync = {
  confirmed: notifyConfirmed,
  queued: () => publish('queued', 'Queued locally (offline)'),
  rateLimited: () => publish('rate-limited', 'Rate limited — retrying...'),
  info: (label: string) => publish('info', label),
};

// ── React component ─────────────────────────────────────────────────────────

export function SyncToast() {
  const { theme } = useTheme();
  const [entry, setEntry] = useState<ToastEntry | null>(currentEntry);

  useEffect(() => {
    const onChange = (next: ToastEntry | null) => setEntry(next);
    listeners.add(onChange);
    return () => { listeners.delete(onChange); };
  }, []);

  useEffect(() => {
    if (!entry) return;
    const seqAtMount = entry.seq;
    const timer = setTimeout(() => {
      // Only clear if a newer entry hasn't arrived in the meantime — a fresh
      // publish bumps `currentEntry.seq` and gets its own dismiss timer.
      if (currentEntry?.seq === seqAtMount) emit(null);
    }, DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [entry?.seq]);

  if (!entry) return null;

  const palette: Record<SyncToastStatus, { bg: string; border: string; color: string }> = {
    confirmed: {
      bg: theme.successBg,
      border: theme.successBorder,
      color: theme.successText ?? theme.success,
    },
    queued: {
      bg: theme.warningBg,
      border: theme.warningBorder,
      color: theme.warningText ?? theme.warning,
    },
    'rate-limited': {
      bg: theme.dangerBg,
      border: theme.dangerBorder,
      color: theme.dangerText ?? theme.danger,
    },
    info: {
      bg: theme.accentBg,
      border: theme.accent,
      color: theme.accent,
    },
  };
  const cfg = palette[entry.status];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '8px 16px',
        borderRadius: 8,
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        color: cfg.color,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "'JetBrains Mono', monospace",
        zIndex: 9999,
        pointerEvents: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      {entry.label}
    </div>
  );
}
