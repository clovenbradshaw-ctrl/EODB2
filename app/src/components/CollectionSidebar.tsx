import { useMemo, useState } from 'react';
import { useEoStore } from '../store/eo-store';

interface Props {
  selected: string | null;
  onSelect(collection: string | null): void;
}

/**
 * Left sidebar. A "collection" is the first segment of a site's dot-path
 * (e.g. `tblCases` in `tblCases.rec123`). Bare sites (no dot) get their
 * own pseudo-collection `(no collection)`.
 *
 * The "+ New collection" button is the primitive we were missing in v1:
 * dispatches an INS at `<name>` (a bare site representing the collection
 * itself), so other devices see it on hydrate and we can create records
 * inside it.
 */
export function CollectionSidebar({ selected, onSelect }: Props) {
  const records = useEoStore((s) => s.records);
  const dispatch = useEoStore((s) => s.dispatch);
  const session = useEoStore((s) => s.session);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');

  const collections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const rec of records.values()) {
      if (rec.cleared) continue;
      // Don't count media-child sites toward collection counts.
      if (rec.site.includes('.media.')) continue;
      const dot = rec.site.indexOf('.');
      const col = dot === -1 ? rec.site : rec.site.slice(0, dot);
      counts.set(col, (counts.get(col) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [records]);

  async function createCollection(name: string) {
    const trimmed = name.trim().replace(/\s+/g, '_');
    if (!trimmed) return;
    if (!session) return;
    await dispatch({
      operator: 'INS',
      site: trimmed,
      resolution: { _kind: 'collection', name: name.trim() },
      ts: Date.now(),
      agent: session.userId,
    });
    setDraft('');
    setCreating(false);
    onSelect(trimmed);
  }

  return (
    <aside style={styles.aside}>
      <div style={styles.header}>Collections</div>

      <button
        style={{ ...styles.item, ...(selected === null ? styles.itemActive : {}) }}
        onClick={() => onSelect(null)}
      >
        <span style={styles.itemLabel}>All records</span>
        <span style={styles.itemCount}>{records.size}</span>
      </button>

      {collections.map(([col, count]) => (
        <button
          key={col}
          style={{ ...styles.item, ...(selected === col ? styles.itemActive : {}) }}
          onClick={() => onSelect(col)}
        >
          <span style={styles.itemLabel}>{col}</span>
          <span style={styles.itemCount}>{count}</span>
        </button>
      ))}

      {creating ? (
        <form
          style={styles.newForm}
          onSubmit={(e) => { e.preventDefault(); void createCollection(draft); }}
        >
          <input
            autoFocus
            style={styles.newInput}
            placeholder="Collection name…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { if (!draft.trim()) setCreating(false); }}
          />
        </form>
      ) : (
        <button style={styles.newBtn} onClick={() => setCreating(true)}>
          + New collection
        </button>
      )}
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  aside: {
    width: 220, borderRight: '1px solid #2a2a33', background: '#141418',
    padding: 12, display: 'flex', flexDirection: 'column', gap: 2,
    fontFamily: 'ui-monospace, monospace', fontSize: 12,
  },
  header: { color: '#7a7a88', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, padding: '0 8px' },
  item: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 8px', borderRadius: 4, border: 'none', background: 'transparent',
    color: '#e0e0e6', cursor: 'pointer', textAlign: 'left' as const,
  },
  itemActive: { background: '#1c1c22', color: '#6ee7b7' },
  itemLabel: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1 },
  itemCount: { color: '#7a7a88', fontSize: 10 },
  newBtn: {
    marginTop: 12, padding: '6px 8px', borderRadius: 4, border: '1px dashed #2a2a33',
    background: 'transparent', color: '#7a7a88', cursor: 'pointer', textAlign: 'left' as const,
    fontFamily: 'ui-monospace, monospace', fontSize: 12,
  },
  newForm: { marginTop: 12 },
  newInput: {
    width: '100%', boxSizing: 'border-box' as const, padding: '6px 8px',
    background: '#1c1c22', border: '1px solid #2d6e54', borderRadius: 4,
    color: '#e0e0e6', fontFamily: 'ui-monospace, monospace', fontSize: 12, outline: 'none',
  },
};
