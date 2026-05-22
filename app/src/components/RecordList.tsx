import { useMemo, useState } from 'react';
import { useEoStore } from '../store/eo-store';

interface Props {
  collection: string | null;
  onOpen(site: string): void;
}

export function RecordList({ collection, onOpen }: Props) {
  const records = useEoStore((s) => s.records);
  const dispatch = useEoStore((s) => s.dispatch);
  const session = useEoStore((s) => s.session);
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');

  const rows = useMemo(() => {
    const all = Array.from(records.values()).filter((r) => !r.cleared);
    // Hide media child sites — they're rendered inside the parent record's
    // drawer, not as top-level rows.
    let scoped = all.filter((r) => !r.site.includes('.media.'));
    if (collection !== null) {
      scoped = all.filter((r) => {
        const dot = r.site.indexOf('.');
        const col = dot === -1 ? r.site : r.site.slice(0, dot);
        // Hide the bare-collection marker row (e.g. site === `tblCases`)
        // when listing inside that collection — we only want its members.
        if (r.site === collection) return false;
        return col === collection;
      });
    } else {
      // Hide bare-collection marker rows from "All records" too — they're
      // sidebar entries, not data.
      scoped = scoped.filter((r) => r.resolution?._kind !== 'collection');
    }
    if (filter.trim()) {
      const q = filter.toLowerCase();
      scoped = scoped.filter((r) =>
        r.site.toLowerCase().includes(q) ||
        JSON.stringify(r.resolution).toLowerCase().includes(q),
      );
    }
    return scoped.sort((a, b) => b.last_ts - a.last_ts);
  }, [records, collection, filter]);

  async function newRecord(name: string) {
    if (!session) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = trimmed.replace(/\s+/g, '_').toLowerCase() + '_' + Math.random().toString(36).slice(2, 8);
    const site = collection ? `${collection}.${id}` : id;
    await dispatch({
      operator: 'INS',
      site,
      resolution: { name: trimmed },
      ts: Date.now(),
      agent: session.userId,
    });
    setDraftName('');
    setCreating(false);
    onOpen(site);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.toolbar}>
        <input
          style={styles.search}
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {collection !== null && (
          creating ? (
            <form
              style={{ display: 'flex', gap: 8 }}
              onSubmit={(e) => { e.preventDefault(); void newRecord(draftName); }}
            >
              <input
                autoFocus
                style={styles.search}
                placeholder="Record name…"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => { if (!draftName.trim()) setCreating(false); }}
              />
              <button style={styles.primary} type="submit">Create</button>
            </form>
          ) : (
            <button style={styles.primary} onClick={() => setCreating(true)}>+ New record</button>
          )
        )}
      </div>

      {rows.length === 0 && (
        <div style={styles.empty}>
          {collection === null
            ? 'No records yet. Pick a collection from the sidebar and add one.'
            : `No records in "${collection}". Click "+ New record" to add one.`}
        </div>
      )}

      {rows.length > 0 && (
        <div style={styles.list}>
          {rows.map((r) => (
            <button key={r.site} style={styles.row} onClick={() => onOpen(r.site)}>
              <div style={styles.site}>{r.site}</div>
              <div style={styles.preview}>
                {Object.entries(r.resolution)
                  .filter(([k]) => !k.startsWith('_'))
                  .slice(0, 3)
                  .map(([k, v]) => `${k}=${String(v).slice(0, 30)}`)
                  .join(' · ')}
              </div>
              <div style={styles.ts}>{new Date(r.last_ts).toLocaleString()}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12, height: '100%' },
  toolbar: { display: 'flex', gap: 8, alignItems: 'center' },
  search: {
    flex: 1, padding: '8px 10px', background: '#1c1c22', border: '1px solid #2a2a33',
    borderRadius: 4, color: '#e0e0e6', fontFamily: 'ui-monospace, monospace', fontSize: 13, outline: 'none',
  },
  primary: {
    padding: '8px 14px', background: '#2d6e54', color: '#6ee7b7',
    border: '1px solid #6ee7b7', borderRadius: 4, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'ui-monospace, monospace',
  },
  empty: { color: '#7a7a88', fontFamily: 'ui-monospace, monospace', fontSize: 13, padding: 24, textAlign: 'center' as const },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  row: {
    display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 12,
    padding: '10px 12px', background: '#141418', border: '1px solid #2a2a33', borderRadius: 4,
    color: '#e0e0e6', cursor: 'pointer', textAlign: 'left' as const,
    fontFamily: 'ui-monospace, monospace', fontSize: 12,
  },
  site: { color: '#6ee7b7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  preview: { color: '#a0a0aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  ts: { color: '#7a7a88', fontSize: 10 },
};
