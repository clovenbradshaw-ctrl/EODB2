import { useEffect, useMemo, useRef, useState } from 'react';
import { initial, foldFrom, type Entity, type FoldState } from '../foundation/fold.js';
import {
  getTimeline,
  loadFullTimeline,
  onDecrypted,
  onTimeline,
  type AppRoom,
} from '../foundation/rooms.js';
import { ins, def, seg } from '../foundation/operators.js';

interface Props {
  room: AppRoom;
  userId: string;
  onLog: (msg: string, level?: 'info' | 'error') => void;
}

const DELETED_PARTITION = 'deleted';

export function TableView({ room, userId, onLog }: Props) {
  // The fold mutates state in place for speed, so React doesn't see new refs.
  // We bump a version counter on every event to force re-render; the state
  // object is read fresh on each render.
  const stateRef = useRef<FoldState>(initial());
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

  // Per-room: reset fold, hydrate from full timeline, subscribe to live events.
  useEffect(() => {
    const roomId = room.roomId;
    let cancelled = false;
    stateRef.current = initial();
    setVersion(0);
    setLoading(true);
    setExtraColumns([]);
    setEditing(null);

    (async () => {
      try {
        await loadFullTimeline(roomId);
        if (cancelled) return;
        const events = getTimeline(roomId);
        foldFrom(stateRef.current, events);
        setLoading(false);
        setVersion((v) => v + 1);
      } catch (e) {
        if (!cancelled) onLog(e instanceof Error ? e.message : String(e), 'error');
      }
    })();

    const unsubLive = onTimeline(roomId, (event) => {
      foldFrom(stateRef.current, [event]);
      setVersion((v) => v + 1);
    });
    const unsubDecrypted = onDecrypted(roomId, (event) => {
      foldFrom(stateRef.current, [event]);
      setVersion((v) => v + 1);
    });

    return () => {
      cancelled = true;
      unsubLive();
      unsubDecrypted();
    };
  }, [room.roomId, onLog]);

  const state = stateRef.current;

  // Entities of the selected type that aren't in the 'deleted' partition.
  // The fold's state.partitions is anchor → partition name.
  const rows: Entity[] = useMemo(() => {
    void version;
    const list = Object.values(state.entities).filter(
      (e) => e._type === entityType && state.partitions[e._anchor] !== DELETED_PARTITION,
    );
    list.sort((a, b) => (a._created ?? 0) - (b._created ?? 0));
    return list;
  }, [state, entityType, version]);

  // Columns: union of all non-underscore payload keys across visible rows,
  // plus any locally added columns the user wants to see even before they
  // contain values.
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
      // Parse simple JSON values so booleans / numbers round-trip cleanly,
      // but fall back to a string so the user can type freeform text.
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
                        <span className="cell-value">{display || <span className="dim">—</span>}</span>
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
      <div className="dim small">
        You: {userId}
      </div>
    </div>
  );
}
