import { useState } from 'react';
import type { Entity } from '../foundation/fold.js';
import type { FieldSchema } from '../schema';
import { Cell } from './Cell';

interface Props {
  entity: Entity;
  fields: FieldSchema[];
  onCommit: (path: string, value: unknown) => Promise<void> | void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Right-side drawer for one entity. Renders every field — schema-typed
 * ones first, then any ad-hoc keys not in the schema (legacy rows or
 * fields that predate their type declaration). Each field uses the same
 * Cell component as the grid for consistent edit semantics.
 *
 * Footer carries entity metadata (anchor, created/updated, sender) and
 * a delete action; backdrop click closes without losing edits.
 */
export function RecordDrawer({ entity, fields, onCommit, onDelete, onClose }: Props) {
  const [editing, setEditing] = useState<{
    path: string;
    value: string;
  } | null>(null);

  const adHocKeys = Object.keys(entity).filter(
    (k) => !k.startsWith('_') && !fields.some((f) => f.name === k),
  );
  const adHocFields: FieldSchema[] = adHocKeys.map((name, i) => ({
    name,
    type: 'text',
    order: fields.length + i,
  }));
  const allFields = [...fields, ...adHocFields];

  const created = entity._created ? new Date(entity._created).toLocaleString() : '—';
  const updated = entity._updated ? new Date(entity._updated).toLocaleString() : null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Record details">
        <header className="drawer-header">
          <h2>{entity._type}</h2>
          <button className="ghost" onClick={onClose} title="Close">
            ✕
          </button>
        </header>

        <div className="drawer-body">
          {allFields.length === 0 && (
            <div className="dim small">No fields yet. Add columns in the grid view.</div>
          )}
          {allFields.map((f) => {
            const isEditing = !!editing && editing.path === f.name;
            const raw = entity[f.name];
            return (
              <div key={f.name} className="drawer-field">
                <label>
                  {f.name} <span className="col-type">{f.type}</span>
                </label>
                <table className="drawer-field-cell">
                  <tbody>
                    <tr>
                      <Cell
                        field={f}
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
                          setEditing({ path: f.name, value: display });
                        }}
                        onChangeDraft={(next) => setEditing({ path: f.name, value: next })}
                        onCommit={(parsed) => {
                          setEditing(null);
                          void onCommit(f.name, parsed);
                        }}
                        onCancel={() => setEditing(null)}
                        onToggle={() => {
                          void onCommit(f.name, !raw);
                        }}
                      />
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <footer className="drawer-footer">
          <div className="drawer-meta">
            <div>
              <span className="dim">anchor</span>{' '}
              <span className="mono">{entity._anchor}</span>
            </div>
            <div>
              <span className="dim">created</span> {created}
              {updated && (
                <>
                  {' · '}
                  <span className="dim">updated</span> {updated}
                </>
              )}
            </div>
            {entity._sender && (
              <div>
                <span className="dim">by</span> {entity._sender}
              </div>
            )}
          </div>
          <button
            className="ghost danger"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            Delete row
          </button>
        </footer>
      </aside>
    </>
  );
}
