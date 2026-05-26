import type { FieldSchema } from '../schema';
import { coerceValue, formatValue } from '../schema';

interface Props {
  field: FieldSchema;
  value: unknown;
  editing: boolean;
  draft: string;
  onStartEdit: () => void;
  onChangeDraft: (next: string) => void;
  onCommit: (parsed: unknown) => void;
  onCancel: () => void;
  onToggle?: () => void;
}

/**
 * One typed cell. Rendering and editing behavior diverge by field type:
 *   - checkbox: toggles inline, no separate edit mode
 *   - select: dropdown when editing
 *   - number / date: typed <input>
 *   - text: free-form <input> (default)
 */
export function Cell({
  field,
  value,
  editing,
  draft,
  onStartEdit,
  onChangeDraft,
  onCommit,
  onCancel,
  onToggle,
}: Props) {
  if (field.type === 'checkbox') {
    const checked = !!value;
    return (
      <td onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle?.()}
          className="cell-checkbox"
        />
      </td>
    );
  }

  if (!editing) {
    const display = formatValue(field.type, value);
    return (
      <td onClick={onStartEdit}>
        <span className="cell-value">{display || <span className="dim">—</span>}</span>
      </td>
    );
  }

  const commit = () => onCommit(coerceValue(field.type, draft));

  if (field.type === 'select') {
    return (
      <td>
        <select
          autoFocus
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            onChangeDraft(next);
            onCommit(coerceValue(field.type, next));
          }}
          onBlur={commit}
        >
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </td>
    );
  }

  const inputType =
    field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';

  return (
    <td>
      <input
        autoFocus
        type={inputType}
        value={draft}
        onChange={(e) => onChangeDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') onCancel();
        }}
      />
    </td>
  );
}
