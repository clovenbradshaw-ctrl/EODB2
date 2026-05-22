import { useEffect, useMemo, useState } from 'react';
import { useEoStore } from '../store/eo-store';

interface Props {
  site: string;
  onClose(): void;
}

/**
 * Right-side drawer showing a record's current resolution + an edit form.
 * Editing dispatches a DEF event (field-level merge). The form rebuilds
 * itself when the record's last_ts changes (i.e. on every update).
 */
export function RecordDrawer({ site, onClose }: Props) {
  const records = useEoStore((s) => s.records);
  const dispatch = useEoStore((s) => s.dispatch);
  const session = useEoStore((s) => s.session);
  const record = records.get(site);

  const initial = useMemo(() => JSON.stringify(record?.resolution ?? {}, null, 2), [record?.last_ts]);
  const [draft, setDraft] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset draft when switching records.
  useEffect(() => { setDraft(initial); setErr(null); }, [site, initial]);

  async function save() {
    if (!session) return;
    setErr(null);
    let parsed: any;
    try { parsed = JSON.parse(draft); }
    catch (e: any) { setErr('Not valid JSON: ' + e?.message); return; }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setErr('Resolution must be a JSON object'); return;
    }
    setSaving(true);
    try {
      await dispatch({
        operator: 'DEF',
        site,
        resolution: parsed,
        ts: Date.now(),
        agent: session.userId,
      });
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function clearRecord() {
    if (!session) return;
    if (!confirm(`Clear ${site}?`)) return;
    await dispatch({
      operator: 'NUL',
      site,
      resolution: {},
      ts: Date.now(),
      agent: session.userId,
    });
    onClose();
  }

  if (!record) {
    return (
      <aside style={styles.aside}>
        <div style={styles.header}>
          <div style={styles.title}>{site}</div>
          <button style={styles.close} onClick={onClose}>×</button>
        </div>
        <div style={styles.empty}>Record not found.</div>
      </aside>
    );
  }

  return (
    <aside style={styles.aside}>
      <div style={styles.header}>
        <div style={styles.title}>{site}</div>
        <button style={styles.close} onClick={onClose}>×</button>
      </div>
      <div style={styles.meta}>
        last touched {new Date(record.last_ts).toLocaleString()}
        {record.last_event_id && record.last_event_id.startsWith('$pending:') && ' · pending…'}
      </div>
      <label style={styles.label}>Resolution (JSON)</label>
      <textarea
        style={styles.textarea}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
      />
      {err && <div style={styles.err}>{err}</div>}
      <div style={styles.row}>
        <button style={styles.primary} disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button style={styles.danger} onClick={clearRecord}>Clear (NUL)</button>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  aside: {
    width: 420, borderLeft: '1px solid #2a2a33', background: '#141418',
    padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
    fontFamily: 'ui-monospace, monospace', fontSize: 12, overflow: 'auto',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#6ee7b7', fontSize: 14, fontWeight: 600, wordBreak: 'break-all' as const },
  close: {
    background: 'transparent', border: 'none', color: '#7a7a88',
    fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1,
  },
  meta: { color: '#7a7a88', fontSize: 11 },
  label: { color: '#7a7a88', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: 1.2, marginTop: 8 },
  textarea: {
    minHeight: 240, padding: 10, background: '#1c1c22', border: '1px solid #2a2a33',
    borderRadius: 4, color: '#e0e0e6', fontFamily: 'ui-monospace, monospace',
    fontSize: 12, resize: 'vertical' as const, outline: 'none',
  },
  row: { display: 'flex', gap: 8, marginTop: 8 },
  primary: {
    padding: '8px 14px', background: '#2d6e54', color: '#6ee7b7',
    border: '1px solid #6ee7b7', borderRadius: 4, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'ui-monospace, monospace',
  },
  danger: {
    padding: '8px 14px', background: 'transparent', color: '#f87171',
    border: '1px solid #f87171', borderRadius: 4, fontSize: 12,
    cursor: 'pointer', fontFamily: 'ui-monospace, monospace',
  },
  err: { color: '#f87171', fontSize: 11, padding: 8, background: '#2a1414', borderRadius: 4 },
  empty: { color: '#7a7a88', fontSize: 12 },
};
