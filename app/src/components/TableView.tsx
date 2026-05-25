import { useEffect, useMemo, useRef, useState } from 'react';
import { initial, foldFrom, type Entity, type FoldState } from '../foundation/fold.js';
import {
  getTimeline,
  loadTimelineSince,
  onDecrypted,
  onTimeline,
  type AppRoom,
} from '../foundation/rooms.js';
import { ins, def, seg, getNamespace } from '../foundation/operators.js';
import { EventStore } from '../foundation/store.js';
import { getClient } from '../foundation/client.js';

interface Props {
  room: AppRoom;
  userId: string;
  onLog: (msg: string, level?: 'info' | 'error') => void;
}

const DELETED_PARTITION = 'deleted';

// The SDK fires Timeline events for its own local-echo placeholders
// (event_id starts with "~") before the server accepts them. We skip
// those — the real echo arrives via /sync once the server has the event.
function isPlaceholder(event: unknown): boolean {
  const get = (event as { getId?: () => string | null }).getId;
  const eventId = typeof get === 'function' ? get.call(event) : (event as { event_id?: string }).event_id;
  return typeof eventId === 'string' && eventId.startsWith('~');
}

export function TableView({ room, userId, onLog }: Props) {
  // committedState is folded from real events (store + server). The fold
  // mutates in place for speed, so we bump a version counter to force
  // re-render rather than swapping the reference.
  const stateRef = useRef<FoldState>(initial());
  const storeRef = useRef<EventStore | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  const [entityType, setEntityType] = useState('record');
  const [extraColumns, setExtraColumns] = useState<string[]>([]);
  const [newColumn, setNewColumn] = useState('');
  const [editing, setEditing] = useState<{
    anchor: string;
    path: string;
    value: string;
  } | null>(null);

  useEffect(() => {
    const roomId = room.roomId;
    let cancelled = false;
    stateRef.current = initial();
    setVersion(0);
    setLoading(true);
    setExtraColumns([]);
    setEditing(null);

    (async () => {
      const store = new EventStore(roomId, getNamespace());
      await store.open();
      storeRef.current = store;
      if (cancelled) return;

      // Replay everything we have locally first — instant render, offline-safe.
      try {
        const stored = await store.getAll();
        foldFrom(stateRef.current, stored);
        if (cancelled) return;
        setLoading(false);
        setVersion((v) => v + 1);
      } catch (e) {
        onLog(`Local replay failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
      }

      // Then ask the server for events since the store's cursor. Best-effort:
      // an offline boot just shows the local replay.
      try {
        const cursor = store.getCursor();
        const { newEvents } = await loadTimelineSince(roomId, cursor);
        if (cancelled) return;
        const fresh = newEvents.filter((e) => !isPlaceholder(e));
        const added = await store.append(fresh);
        if (added.length > 0) {
          foldFrom(stateRef.current, added);
          setVersion((v) => v + 1);
        }
      } catch (e) {
        onLog(
          `Server sync deferred (offline?): ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      // From here, live events flow through the store before folding so
      // dedup + persistence happen in one place.
      const client = getClient();
      if (!client) return;
    })();

    const unsubLive = onTimeline(roomId, async (event) => {
      if (cancelled) return;
      if (isPlaceholder(event)) return;
      const store = storeRef.current;
      if (!store) return;
      const added = await store.append([event]);
      if (added.length > 0) {
        foldFrom(stateRef.current, added);
        setVersion((v) => v + 1);
      }
    });
    const unsubDecrypted = onDecrypted(roomId, async (event) => {
      if (cancelled) return;
      if (isPlaceholder(event)) return;
      const store = storeRef.current;
      if (!store) return;
      const added = await store.append([event]);
      if (added.length > 0) {
        foldFrom(stateRef.current, added);
        setVersion((v) => v + 1);
      }
    });

    return () => {
      cancelled = true;
      unsubLive();
      unsubDecrypted();
      storeRef.current = null;
    };
  }, [room.roomId, onLog]);

  const state = stateRef.current;

  const rows: Entity[] = useMemo(() => {
    void version;
    const list = Object.values(state.entities).filter(
      (e) => e._type === entityType && state.partitions[e._anchor] !== DELETED_PARTITION,
    );
    list.sort((a, b) => (a._created ?? 0) - (b._created ?? 0));
    return list;
  }, [state, entityType, version]);

  const columns: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (!key.startsWith('_')) set.add(key);
      }
    }
    for (const col of extraColumns) set.add(col);
    return Array.from(set).sort();
  }, [rows, extraColumns]);

  const distinctTypes = useMemo(() => {
    void version;
    const set = new Set<string>();
    for (const e of Object.values(state.entities)) {
      if (state.partitions[e._anchor] !== DELETED_PARTITION) {
        set.add(e._type);
      }
    }
    set.add(entityType);
    return Array.from(set).sort();
  }, [state, entityType, version]);

  const handleAddRow = async () => {
    try {
      await ins(room.roomId, entityType, {});
    } catch (e) {
      onLog(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const handleDelete = async (anchor: string) => {
    try {
      await seg(room.roomId, anchor, DELETED_PARTITION);
    } catch (e) {
      onLog(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const handleAddColumn = () => {
    const name = newColumn.trim();
    if (!name) return;
    if (name.startsWith('_')) {
      onLog('Column names cannot start with underscore', 'error');
      return;
    }
    setExtraColumns((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setNewColumn('');
  };

  const commitEdit = async () => {
    if (!editing) return;
    const { anchor, path, value } = editing;
    setEditing(null);
    try {
      let parsed: unknown = value;
      const trimmed = value.trim();
      if (trimmed === 'true' || trimmed === 'false') parsed = trimmed === 'true';
      else if (trimmed !== '' && !Number.isNaN(Number(trimmed))) parsed = Number(trimmed);
      await def(room.roomId, anchor, path, parsed);
    } catch (e) {
      onLog(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  if (loading) {
    return <div className="empty">Loading {room.name}…</div>;
  }

  return (
    <div className="table-view">
      <div className="toolbar">
        <label>
          Type
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            {distinctTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button onClick={handleAddRow}>+ Row</button>
        <input
          placeholder="New column"
          value={newColumn}
          onChange={(e) => setNewColumn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddColumn();
          }}
        />
        <button onClick={handleAddColumn}>+ Column</button>
        <span className="dim small">
          {rows.length} row(s) · {state.cursor ? new Date(state.cursor).toLocaleString() : '—'}
        </span>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="anchor-col">anchor</th>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
              <th className="row-actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="empty-row">
                  No rows yet. Click + Row to start.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row._anchor}>
                <td className="anchor-col dim">{row._anchor}</td>
                {columns.map((c) => {
                  const isEditing =
                    editing && editing.anchor === row._anchor && editing.path === c;
                  const raw = row[c];
                  const display =
                    raw === undefined || raw === null
                      ? ''
                      : typeof raw === 'object'
                        ? JSON.stringify(raw)
                        : String(raw);
                  return (
                    <td
                      key={c}
                      onClick={() => {
                        if (!isEditing) {
                          setEditing({ anchor: row._anchor, path: c, value: display });
                        }
                      }}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editing!.value}
                          onChange={(e) =>
                            setEditing({
                              anchor: row._anchor,
                              path: c,
                              value: e.target.value,
                            })
                          }
                          onBlur={() => {
                            void commitEdit();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void commitEdit();
                            } else if (e.key === 'Escape') {
                              setEditing(null);
                            }
                          }}
                        />
                      ) : (
                        <span className="cell-value">
                          {display || <span className="dim">—</span>}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="row-actions">
                  <button
                    className="ghost small"
                    onClick={() => handleDelete(row._anchor)}
                    title="Delete row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state._undecryptable > 0 && (
        <div className="warning small">
          {state._undecryptable} undecrypted event(s) — waiting for keys.
        </div>
      )}
      <div className="dim small">You: {userId}</div>
    </div>
  );
}
