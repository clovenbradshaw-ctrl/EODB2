/**
 * Phase 2 — session lifecycle.
 *
 * Pins the transition table (the latch that makes logout idempotent) and
 * the account-storage allow/deny split for the localStorage purge.
 */

import { describe, it, expect } from 'vitest';
import {
  canTransitionSession,
  isTerminalSessionPhase,
  clearAccountLocalStorage,
  type SessionPhase,
} from '../session-lifecycle';

const ALL_PHASES: SessionPhase[] = ['active', 'expired', 'purging', 'signed-out'];

describe('session lifecycle state machine', () => {
  it('allows exactly the legal transitions', () => {
    const legal = new Set([
      'active->expired',
      'active->purging',
      'expired->purging',
      'purging->signed-out',
    ]);
    for (const from of ALL_PHASES) {
      for (const to of ALL_PHASES) {
        expect(canTransitionSession(from, to)).toBe(legal.has(`${from}->${to}`));
      }
    }
  });

  it('treats purging and signed-out as terminal', () => {
    expect(isTerminalSessionPhase('active')).toBe(false);
    expect(isTerminalSessionPhase('expired')).toBe(false);
    expect(isTerminalSessionPhase('purging')).toBe(true);
    expect(isTerminalSessionPhase('signed-out')).toBe(true);
  });

  it('never transitions out of signed-out', () => {
    for (const to of ALL_PHASES) {
      expect(canTransitionSession('signed-out', to)).toBe(false);
    }
  });

  it('does not allow expired to revert to active', () => {
    expect(canTransitionSession('expired', 'active')).toBe(false);
  });
});

describe.skipIf(typeof localStorage === 'undefined')(
  'clearAccountLocalStorage',
  () => {
    it('removes account-scoped keys and prefixes, preserves device prefs', () => {
      localStorage.clear();
      // Account-scoped — must be wiped.
      localStorage.setItem('eo-db-session', '{}');
      localStorage.setItem('eo-db-device-id', 'DEV1');
      localStorage.setItem('eo-selected-space', 'space-a');
      localStorage.setItem('eo-active-user-type', 'attorney');
      localStorage.setItem('eo-spaces', '[]');
      localStorage.setItem('eo-spacemeta:space-a', '{}');
      localStorage.setItem('eo-db-hydrated-head:!room', '$ev');
      localStorage.setItem('eo-db-auto-ingest:!room', '1');
      // Device-level prefs — must survive.
      localStorage.setItem('eo-theme', 'dark');
      localStorage.setItem('eo:detailsPanelCollapsed', '1');

      clearAccountLocalStorage();

      expect(localStorage.getItem('eo-db-session')).toBeNull();
      expect(localStorage.getItem('eo-db-device-id')).toBeNull();
      expect(localStorage.getItem('eo-selected-space')).toBeNull();
      expect(localStorage.getItem('eo-active-user-type')).toBeNull();
      expect(localStorage.getItem('eo-spaces')).toBeNull();
      expect(localStorage.getItem('eo-spacemeta:space-a')).toBeNull();
      expect(localStorage.getItem('eo-db-hydrated-head:!room')).toBeNull();
      expect(localStorage.getItem('eo-db-auto-ingest:!room')).toBeNull();

      expect(localStorage.getItem('eo-theme')).toBe('dark');
      expect(localStorage.getItem('eo:detailsPanelCollapsed')).toBe('1');
    });
  },
);
