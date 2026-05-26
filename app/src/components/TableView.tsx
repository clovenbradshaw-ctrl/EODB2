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
import {
  addField,
  getTypeFields,
  type FieldSchema,
  type FieldType,
} from '../schema';
import { AddColumnForm } from './AddColumnForm';
import { Cell } from './Cell';
import { RecordDrawer } from './RecordDrawer';
import { KanbanView } from './KanbanView';
import { FilterBar } from './FilterBar';
import { applyFilters, applySort, type Filter, type Sort } from '../query';

type ViewKind = 'grid' | 'kanban';

interface Props {
  room: AppRoom;
  userId: string;
  onLog: (msg: string, level?: 'info' | 'error') => void;
}

const DELETED_PARTITION = 'deleted';

// SDK fires Timeline for its own placeholders (event_id starts with "~")
// before the server accepts the send. Skip those — the real echo arrives
// via /sync with a real event id.
function isPlaceholder(event: unknown): boolean {
  const get = (event as { getId?: () => string | null }).getId;
  const eventId = typeof get === 'function' ? get.call(event) : (event as { event_id?: string }).event_id;
  return typeof eventId === 'string' && eventId.startsWith('~');
}

export function TableView({ room, userId, onLog }: Props) {
  const stateRef = useRef<FoldState>(initial());
  const storeRef = useRef<EventStore | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  const [entityType, setEntityType] = useState('record');
  const [viewKind, setViewKind] = useState<ViewKind>('grid');
  const [kanbanField, setKanbanField] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    anchor: string;
    path: string;
    value: string;
  } | null>(null);
  const [selectedAnchor, setSelectedAnchor] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<Sort | null>(null);

  useEffect(() => {
    const roomId = room.roomId;
    let cancelled = false;
    stateRef.current = initial();
    setVersion(0);
    setLoading(true);
    setEditing(null);
    setSelectedAnchor(null);
    setViewKind('grid');
    setKanbanField(null);
    setFilters([]);
    setSort(null);

    (async () => {
      const store = new EventStore(roomId, getNamespace());
      await store.open();
      storeRef.current = store;
      if (cancelled) return;

      try {
        const stored = await store.getAll();
        foldFrom(stateRef.current, stored);
        if (cancelled) return;
        setLoading(false);
        setVersion((v) => v + 1);
      } catch (e) {
        onLog(`Local replay failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
      }

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

  void getClient; // referenced inside async wiring above; keep import alive for d.ts

  const state = stateRef.current;

  // Base row set: every entity of the chosen type that isn't deleted.
  // Sorted by creation time so unsorted views still feel stable.
  const baseRows: Entity[] = useMemo(() => {
    void version;
    const list = Object.values(state.entities).filter(
      (e) => e._type === entityType && state.partitions[e._anchor] !== DELETED_PARTITION,
    );
    list.sort((a, b) => (a._created ?? 0) - (b._created ?? 0));
    return list;
  }, [state, entityType, version]);

  // Visible rows after running the query pipeline. Grid + Kanban both
  // consume this — filters and sort apply uniformly across views.
  const rows: Entity[] = useMemo(
    () => applySort(applyFilters(baseRows, filters), sort),
    [baseRows, filters, sort],
  );

  // Columns come from three places: explicit schema (defSchema events),
  // ad-hoc keys actually present on rows, and the schema-implied order.
  // Schema fields render first; ad-hoc keys (legacy / pre-schema rows)
  // append after them so nothing is hidden.
  const schemaFields: FieldSchema[] = useMemo(() => {
    void version;
    return getTypeFields(state, entityType);
  }, [state, entityType, version]);

  const columns: FieldSchema[] = useMemo(() => {
    const byName = new Map<string, FieldSchema>();
    for (const f of schemaFields) byName.set(f.name, f);
    let nextOrder = schemaFields.length;
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (key.startsWith('_')) continue;
        if (!byName.has(key)) {
          byName.set(key, { name: key, type: 'text', order: nextOrder++ });
        }
      }
    }
    return Array.from(byName.values()).sort(
      (a, b) => a.order - b.order || a.name.localeCompare(b.name),
    );
  }, [rows, schemaFields]);

  const distinctTypes = useMemo(() => {
    void version;
    const set = new Set<string>();
    for (const e of Object.values(state.entities)) {
      if (state.partitions[e._anchor] !== DELETED_PARTITION) set.add(e._type);
    }
    // Also surface types that exist only in schema, so a freshly-defined
    // type with no rows still appears in the picker.
    for (const t of Object.keys(state.schema || {})) set.add(t);
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

  const handleAddColumn = async (spec: {
    name: string;
    type: FieldType;
    options?: string[];
  }) => {
    await addField(room.roomId, entityType, spec.name, {
      type: spec.type,
      options: spec.options,
      order: columns.length,
    });
  };

  const commitEdit = async (parsed: unknown) => {
    if (!editing) return;
    const { anchor, path } = editing;
    setEditing(null);
    try {
      await def(room.roomId, anchor, path, parsed);
    } catch (e) {
      onLog(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const toggleCheckbox = async (anchor: string, path: string, currentlyChecked: boolean) => {
    try {
      await def(room.roomId, anchor, path, !currentlyChecked);
    } catch (e) {
      onLog(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  if (loading) {
    return <div className="empty">Loading {room.name}…</div>;
  }

  const moveKanban = async (anchor: string, toGroup: string | null) => {
    if (!kanbanField) return;
    try {
      await def(room.roomId, anchor, kanbanField, toGroup);
    } catch (e) {
      onLog(e instanceof Error ? e.message : String(e), 'error');
    }
  };

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
        <div className="view-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={viewKind === 'grid'}
            className={viewKind === 'grid' ? 'active' : ''}
            onClick={() => setViewKind('grid')}
          >
            Grid
          </button>
          <button
            role="tab"
            aria-selected={viewKind === 'kanban'}
            className={viewKind === 'kanban' ? 'active' : ''}
            onClick={() => setViewKind('kanban')}
          >
            Kanban
          </button>
        </div>
        <button onClick={handleAddRow}>+ Row</button>
        {viewKind === 'grid' && <AddColumnForm onAdd={handleAddColumn} onLog={onLog} />}
        <span className="dim small">
          {rows.length}
          {filters.length > 0 && ` / ${baseRows.length}`} row(s) ·{' '}
          {state.cursor ? new Date(state.cursor).toLocaleString() : '—'}
        </span>
      </div>

      <FilterBar
        fields={columns}
        filters={filters}
        sort={sort}
        onFiltersChange={setFilters}
        onSortChange={setSort}
      />

      {viewKind === 'kanban' && (
        <KanbanView
          rows={rows}
          fields={columns}
          groupField={kanbanField}
          onGroupFieldChange={setKanbanField}
          onOpenRecord={setSelectedAnchor}
          onMove={(a, g) => void moveKanban(a, g)}
        />
      )}

      {viewKind === 'grid' && (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="row-expand" />
              <th className="anchor-col">anchor</th>
              {columns.map((c) => (
                <th key={c.name}>
                  {c.name}
                  <span className="col-type">{c.type}</span>
                </th>
              ))}
              <th className="row-actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 3} className="empty-row">
                  No rows yet. Click + Row to start.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row._anchor}>
                <td className="row-expand">
                  <button
                    className="ghost small"
                    title="Open record"
                    onClick={() => setSelectedAnchor(row._anchor)}
                  >
                    ▷
                  </button>
                </td>
                <td className="anchor-col dim">{row._anchor}</td>
                {columns.map((c) => {
                  const isEditing =
                    !!editing && editing.anchor === row._anchor && editing.path === c.name;
                  const raw = row[c.name];
                  return (
                    <Cell
                      key={c.name}
                      field={c}
                      value={raw}
                      editing={isEditing}
                      draft={isEditing ? editing!.value : ''}
                      onStartEdit={() => {
                        const display =
                          raw === undefined || raw === null
                            ? ''
                            : typeof raw === 'object'
                              ? JSON.stringify(raw)
                              : String(raw);
                        setEditing({ anchor: row._anchor, path: c.name, value: display });
                      }}
                      onChangeDraft={(next) =>
                        setEditing({ anchor: row._anchor, path: c.name, value: next })
                      }
                      onCommit={(parsed) => void commitEdit(parsed)}
                      onCancel={() => setEditing(null)}
                      onToggle={() => {
                        void toggleCheckbox(row._anchor, c.name, !!raw);
                      }}
                    />
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
      )}

      {state._undecryptable > 0 && (
        <div className="warning small">
          {state._undecryptable} undecrypted event(s) — waiting for keys.
        </div>
      )}
      <div className="dim small">You: {userId}</div>

      {selectedAnchor && state.entities[selectedAnchor] && (
        <RecordDrawer
          entity={state.entities[selectedAnchor]}
          fields={columns}
          onCommit={async (path, value) => {
            try {
              await def(room.roomId, selectedAnchor, path, value);
            } catch (e) {
              onLog(e instanceof Error ? e.message : String(e), 'error');
            }
          }}
          onDelete={() => void handleDelete(selectedAnchor)}
          onClose={() => setSelectedAnchor(null)}
        />
      )}
    </div>
  );
}
