/**
 * Re-skin — ⌘K command palette.
 *
 * Self-contained: owns its open/close state and the ⌘K / Ctrl+K global
 * shortcut, so the host only has to render it once and hand it a flat list
 * of commands. Renders as a fixed overlay layer (`.cmdk-*` classes in the
 * design system), independent of the surrounding app chrome.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './ui/Icon';
import { Kbd } from './ui/primitives';

export interface Command {
  /** Stable identity — also used as the React key. */
  id: string;
  label: string;
  icon: IconName;
  /** Group heading the command is listed under. */
  group: string;
  /** Short trailing hint (a shortcut letter, a category). */
  hint?: string;
  /** Invoked when the command is chosen. The palette closes afterward. */
  run: () => void;
}

export interface CommandPaletteProps {
  commands: Command[];
}

export function CommandPalette({ commands }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K toggle. Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Reset transient state every time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
      // Focus after the overlay paints.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  // Keep the selected index in range as the filtered list shrinks.
  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!open) return null;

  const choose = (cmd: Command | undefined) => {
    if (!cmd) return;
    setOpen(false);
    cmd.run();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(filtered.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(filtered[sel]);
    }
  };

  // Group the filtered commands in first-seen group order.
  const groups: { title: string; items: Command[] }[] = [];
  for (const cmd of filtered) {
    let g = groups.find((x) => x.title === cmd.group);
    if (!g) {
      g = { title: cmd.group, items: [] };
      groups.push(g);
    }
    g.items.push(cmd);
  }

  // Flat index → used to map a command back to its keyboard-selection slot.
  const flatIndex = (cmd: Command) => filtered.indexOf(cmd);

  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-wrap">
          <Icon name="search" color="var(--muted)" />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search views and actions, or run a command…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            onKeyDown={onListKey}
          />
          <span
            className="kbd"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              color: 'var(--muted)',
              background: 'var(--surface-2)',
              padding: '1px 5px',
              borderRadius: 4,
              border: '1px solid var(--border)',
            }}
          >
            esc
          </span>
        </div>

        <div className="cmdk-list">
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '22px 14px',
                textAlign: 'center',
                color: 'var(--muted)',
                fontSize: 13,
              }}
            >
              Nothing matched “{query}”.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.title}>
                <div className="cmdk-group-title">{g.title}</div>
                {g.items.map((cmd) => {
                  const idx = flatIndex(cmd);
                  return (
                    <div
                      key={cmd.id}
                      className={`cmdk-item ${idx === sel ? 'sel' : ''}`}
                      onMouseEnter={() => setSel(idx)}
                      onClick={() => choose(cmd)}
                    >
                      <span className="ci-ico">
                        <Icon name={cmd.icon} size={15} />
                      </span>
                      <span>{cmd.label}</span>
                      {cmd.hint && <span className="ci-meta">{cmd.hint}</span>}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="cmdk-foot">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span>
            <Kbd>⏎</Kbd> select
          </span>
          <span style={{ marginLeft: 'auto' }}>
            <Kbd>⌘K</Kbd> toggle
          </span>
        </div>
      </div>
    </div>
  );
}
