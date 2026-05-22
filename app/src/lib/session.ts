import type { Session } from '../matrix/rest';

/** localStorage key for the persisted session. One device, one session. */
const KEY = 'eodb2_session';

export function saveSession(s: Session): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota; ignore */ }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && typeof s.accessToken === 'string' && typeof s.userId === 'string') return s as Session;
    return null;
  } catch { return null; }
}

export function clearSession(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
