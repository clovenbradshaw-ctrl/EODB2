/**
 * Re-skin design system — shared primitives.
 *
 * Avatar, Pill, Tag, Kbd — small presentational components used across
 * re-skinned views. Styling lives in `src/styles/design-system.css`.
 */

import type { ReactNode } from 'react';

// ─── Avatar ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

/** Two-letter initials from a display name. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}

/** Deterministic avatar colour bucket for a name. */
export function hashColor(s: string): (typeof AVATAR_COLORS)[number] {
  const h = [...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 0);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** Overrides the initials with an emoji or other glyph. */
  emoji?: string;
}

export function Avatar({ name, size = 'md', emoji }: AvatarProps) {
  return (
    <div className={`avatar ${size} color-${hashColor(name)}`}>
      {emoji || initials(name)}
    </div>
  );
}

// ─── Pill ────────────────────────────────────────────────────────────────────

export type PillTone =
  | 'green' | 'amber' | 'rose' | 'violet' | 'teal' | 'slate' | 'accent';

export interface PillProps {
  tone?: PillTone;
  icon?: boolean;
  children: ReactNode;
}

export function Pill({ tone = 'slate', icon = true, children }: PillProps) {
  return (
    <span className={`pill ${tone}`}>
      {icon && <span className="dot" />}
      {children}
    </span>
  );
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export type TagTone = 'a' | 'b' | 'c' | 'd' | 'e' | 'f';

export interface TagProps {
  tone?: TagTone;
  children: ReactNode;
}

export function Tag({ tone = 'a', children }: TagProps) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

// ─── Kbd ─────────────────────────────────────────────────────────────────────

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}
