import { useState } from 'react';
import type { FieldSchema } from '../schema';
import {
  defaultOperator,
  needsValue,
  operatorLabel,
  operatorsFor,
  type Filter,
  type FilterOperator,
  type Sort,
  type SortDir,
} from '../query';

interface Props {
  fields: FieldSchema[];
  filters: Filter[];
  sort: Sort | null;
  onFiltersChange: (next: Filter[]) => void;
  onSortChange: (next: Sort | null) => void;
}

/**
 * Toolbar block for query controls. Active filters render as
 * removable chips; a "+ Filter" affordance opens an inline form
 * for adding one. Sort is a single field + direction picker.
 */
export function FilterBar({
  fields,
  filters,
  sort,
  onFiltersChange,
  onSortChange,
}: Props) {
  const [adding, setAdding] = useState(false);

  const handleAdd = (filter: Filter) => {
    onFiltersChange([...filters, filter]);
    setAdding(false);
  };

  const handleRemove = (idx: number) => {
    onFiltersChange(filters.filter((_, i) => i !== idx));
  };

  const handleSortField = (name: string) => {
    if (name === '') {
      onSortChange(null);
      return;
    }
    const field = fields.find((f) => f.name === name);
    if (!field) return;
    onSortChange({
      field: field.name,
      fieldType: field.type,
      dir: sort?.dir ?? 'asc',
    });
  };

  const handleSortDir = (dir: SortDir) => {
    if (!sort) return;
    onSortChange({ ...sort, dir });
  };

  return (
    <div className="filter-bar">
      <div className="filter-chips">
        {filters.map((f, i) => (
          <span key={i} className="filter-chip">
            <span className="dim">{f.field}</span> {operatorLabel(f.op)}
            {needsValue(f.op) && (
              <span className="filter-value">
                {' '}
                {f.value === undefined || f.value === null ? '—' : String(f.value)}
              </span>
            )}
            <button className="ghost small" onClick={() => handleRemove(i)} title="Remove filter">
              ✕
            </button>
          </span>
        ))}
        {adding ? (
          <AddFilterForm
            fields={fields}
            onAdd={handleAdd}
            onCancel={() => setAdding(false)}
          />
        ) : (
          fields.length > 0 && (
            <button className="small" onClick={() => setAdding(true)}>
              + Filter
            </button>
          )
        )}
      </div>

      {fields.length > 0 && (
        <div className="sort-control">
          <label className="dim small">Sort</label>
          <select value={sort?.field ?? ''} onChange={(e) => handleSortField(e.target.value)}>
            <option value="">—</option>
            {fields.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
          {sort && (
            <select
              value={sort.dir}
              onChange={(e) => handleSortDir(e.target.value as SortDir)}
            >
              <option value="asc">↑</option>
              <option value="desc">↓</option>
            </select>
          )}
        </div>
      )}
    </div>
  );
}

interface AddProps {
  fields: FieldSchema[];
  onAdd: (filter: Filter) => void;
  onCancel: () => void;
}

function AddFilterForm({ fields, onAdd, onCancel }: AddProps) {
  const first = fields[0];
  const [fieldName, setFieldName] = useState(first.name);
  const [op, setOp] = useState<FilterOperator>(defaultOperator(first.type));
  const [value, setValue] = useState('');

  const field = fields.find((f) => f.name === fieldName) ?? first;
  const ops = operatorsFor(field.type);
  const showValue = needsValue(op);

  const handleFieldChange = (name: string) => {
    setFieldName(name);
    const next = fields.find((f) => f.name === name);
    if (next) {
      setOp(defaultOperator(next.type));
      setValue('');
    }
  };

  const submit = () => {
    const filter: Filter = {
      field: field.name,
      fieldType: field.type,
      op,
    };
    if (showValue) {
      if (value === '') return;
      filter.value = field.type === 'number' ? Number(value) : value;
    }
    onAdd(filter);
  };

  return (
    <div className="add-filter">
      <select value={fieldName} onChange={(e) => handleFieldChange(e.target.value)}>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
          </option>
        ))}
      </select>
      <select value={op} onChange={(e) => setOp(e.target.value as FilterOperator)}>
        {ops.map((o) => (
          <option key={o} value={o}>
            {operatorLabel(o)}
          </option>
        ))}
      </select>
      {showValue && (
        field.type === 'select' ? (
          <select value={String(value)} onChange={(e) => setValue(e.target.value)}>
            <option value="">—</option>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') onCancel();
            }}
            autoFocus
            placeholder="value"
          />
        )
      )}
      <button className="primary small" onClick={submit}>
        Add
      </button>
      <button className="ghost small" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
