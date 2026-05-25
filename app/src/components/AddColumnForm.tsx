import { useState } from 'react';
import { FIELD_TYPES, type FieldType } from '../schema';

interface Props {
  onAdd: (spec: { name: string; type: FieldType; options?: string[] }) => Promise<void>;
  onLog: (msg: string, level?: 'info' | 'error') => void;
}

export function AddColumnForm({ onAdd, onLog }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [options, setOptions] = useState('');

  const submit = async () => {
    if (!name.trim()) return;
    try {
      const spec: { name: string; type: FieldType; options?: string[] } = {
        name: name.trim(),
        type,
      };
      if (type === 'select') {
        const parsed = options
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (parsed.length === 0) {
          onLog('Select columns need at least one option', 'error');
          return;
        }
        spec.options = parsed;
      }
      await onAdd(spec);
      setName('');
      setOptions('');
      setType('text');
    } catch (e) {
      onLog(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  return (
    <div className="add-column">
      <input
        placeholder="New column"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && type !== 'select') void submit();
        }}
      />
      <select value={type} onChange={(e) => setType(e.target.value as FieldType)}>
        {FIELD_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {type === 'select' && (
        <input
          placeholder="opt1, opt2, opt3"
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
      )}
      <button onClick={() => void submit()}>+ Column</button>
    </div>
  );
}
