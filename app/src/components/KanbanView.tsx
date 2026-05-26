import { useMemo } from 'react';
import type { Entity } from '../foundation/fold.js';
import type { FieldSchema } from '../schema';

interface Props {
  rows: Entity[];
  fields: FieldSchema[];
  groupField: string | null;
  onGroupFieldChange: (name: string) => void;
  onOpenRecord: (anchor: string) => void;
  onMove: (anchor: string, toGroup: string | null) => void;
}

const UNSET_KEY = '__unset__';
const UNSET_LABEL = '(unset)';

/**
 * Kanban renderer.
 *
 * Groups the same row set as the grid by a chosen select-type field.
 * Each option becomes a column; entities with no value land in a
 * trailing "(unset)" column. Cards are click-to-open into the drawer.
 *
 * Drag-and-drop is a follow-up layer; for now each card carries a
 * small dropdown that emits the necessary DEF to move it.
 */
export function KanbanView({
  rows,
  fields,
  groupField,
  onGroupFieldChange,
  onOpenRecord,
  onMove,
}: Props) {
  const selectFields = fields.filter((f) => f.type === 'select');

  const field = groupField ? fields.find((f) => f.name === groupField) ?? null : null;
  const options: string[] = field?.options ?? [];

  const groups = useMemo(() => {
    if (!field) return [];
    const map = new Map<string, Entity[]>();
    for (const opt of options) map.set(opt, []);
    map.set(UNSET_KEY, []);
    for (const row of rows) {
      const raw = row[field.name];
      const key = typeof raw === 'string' && options.includes(raw) ? raw : UNSET_KEY;
      const list = map.get(key);
      if (list) list.push(row);
    }
    return Array.from(map.entries());
  }, [rows, options, field]);

  if (selectFields.length === 0) {
    return (
      <div className="empty">
        Kanban needs a <strong>select</strong> field to group by.
        <br />
        Add one in the Grid view (+ Column → select with comma-separated options).
      </div>
    );
  }

  if (!groupField || !field) {
    return (
      <div className="kanban-empty">
        <label>
          Group by{' '}
          <select onChange={(e) => onGroupFieldChange(e.target.value)} defaultValue="">
            <option value="" disabled>
              Pick a select field…
            </option>
            {selectFields.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="kanban">
      <div className="kanban-toolbar">
        <label>
          Group by{' '}
          <select value={field.name} onChange={(e) => onGroupFieldChange(e.target.value)}>
            {selectFields.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="kanban-board">
        {groups.map(([key, entities]) => {
          const label = key === UNSET_KEY ? UNSET_LABEL : key;
          return (
            <div key={key} className={'kanban-column' + (key === UNSET_KEY ? ' unset' : '')}>
              <header>
                <span>{label}</span>
                <span className="dim small">{entities.length}</span>
              </header>
              <div className="kanban-cards">
                {entities.length === 0 && <div className="dim small">—</div>}
                {entities.map((e) => (
                  <Card
                    key={e._anchor}
                    entity={e}
                    fields={fields}
                    groupFieldName={field.name}
                    groupOptions={options}
                    currentGroup={key === UNSET_KEY ? null : key}
                    onOpen={() => onOpenRecord(e._anchor)}
                    onMove={(toGroup) => onMove(e._anchor, toGroup)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CardProps {
  entity: Entity;
  fields: FieldSchema[];
  groupFieldName: string;
  groupOptions: string[];
  currentGroup: string | null;
  onOpen: () => void;
  onMove: (toGroup: string | null) => void;
}

function Card({
  entity,
  fields,
  groupFieldName,
  groupOptions,
  currentGroup,
  onOpen,
  onMove,
}: CardProps) {
  // Show the first two non-group fields as a preview. Falls back to the
  // anchor if no other fields exist yet.
  const previewFields = fields.filter((f) => f.name !== groupFieldName).slice(0, 2);
  return (
    <article className="kanban-card" onClick={onOpen}>
      <div className="kanban-card-body">
        {previewFields.length === 0 && (
          <div className="dim small mono">{entity._anchor}</div>
        )}
        {previewFields.map((f) => {
          const v = entity[f.name];
          if (v === undefined || v === null || v === '') return null;
          const display = typeof v === 'object' ? JSON.stringify(v) : String(v);
          return (
            <div key={f.name} className="kanban-card-field">
              <span className="dim small">{f.name}</span>
              <span>{display}</span>
            </div>
          );
        })}
      </div>
      <select
        className="kanban-card-move"
        value={currentGroup ?? ''}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const next = e.target.value;
          onMove(next === '' ? null : next);
        }}
      >
        <option value="">{UNSET_LABEL}</option>
        {groupOptions.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </article>
  );
}
