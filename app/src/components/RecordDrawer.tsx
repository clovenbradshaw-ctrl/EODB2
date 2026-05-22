import { useEffect, useMemo, useState } from 'react';
import { useEoStore } from '../store/eo-store';
import { uploadMedia, downloadMedia } from '../matrix/rest';

interface Props {
  site: string;
  onClose(): void;
}

interface Attachment {
  site: string;
  mxc_uri: string;
  filename: string;
  size: number;
  content_type?: string;
  sha256?: string;
  ts: number;
  cleared?: boolean;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Right-side drawer showing a record's current resolution, an edit form,
 * and the list of media attachments stored as child sites under
 * `<site>.media.<id>`.
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
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  // Reset draft when switching records.
  useEffect(() => { setDraft(initial); setErr(null); }, [site, initial]);

  // Derive attachments from any record whose site is `<site>.media.*`.
  const attachments = useMemo<Attachment[]>(() => {
    const prefix = site + '.media.';
    const out: Attachment[] = [];
    for (const rec of records.values()) {
      if (!rec.site.startsWith(prefix)) continue;
      const r = rec.resolution ?? {};
      if (typeof r.mxc_uri !== 'string') continue;
      out.push({
        site: rec.site,
        mxc_uri: r.mxc_uri,
        filename: r.filename ?? rec.site.slice(prefix.length),
        size: typeof r.size === 'number' ? r.size : 0,
        content_type: r.content_type,
        sha256: r.sha256,
        ts: rec.last_ts,
        cleared: rec.cleared,
      });
    }
    return out.filter((a) => !a.cleared).sort((a, b) => b.ts - a.ts);
  }, [records, site]);

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

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file || !session) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const data = new Uint8Array(buf);
      const sha = await sha256Hex(buf);
      const { content_uri } = await uploadMedia(
        session,
        data,
        file.type || 'application/octet-stream',
        file.name,
      );
      // Sanitize filename for use as a site segment.
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 64);
      const attachSite = `${site}.media.${Date.now()}_${safe}`;
      await dispatch({
        operator: 'INS',
        site: attachSite,
        resolution: {
          mxc_uri: content_uri,
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          size: file.size,
          sha256: sha,
          uploaded_at: Date.now(),
        },
        ts: Date.now(),
        agent: session.userId,
      });
    } catch (e: any) {
      setUploadErr(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  }

  async function downloadAttachment(att: Attachment) {
    if (!session) return;
    try {
      const resp = await downloadMedia(session, att.mxc_uri);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      setUploadErr(`Download failed: ${e?.message ?? e}`);
    }
  }

  async function removeAttachment(att: Attachment) {
    if (!session) return;
    if (!confirm(`Remove ${att.filename}? (The file stays in Matrix media; the reference is cleared.)`)) return;
    await dispatch({
      operator: 'NUL',
      site: att.site,
      resolution: {},
      ts: Date.now(),
      agent: session.userId,
    });
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

      <label style={styles.label}>Attachments ({attachments.length})</label>
      <label style={styles.fileBtn}>
        {uploading ? 'Uploading…' : '+ Attach file'}
        <input
          type="file"
          style={{ display: 'none' }}
          onChange={onPickFile}
          disabled={uploading}
        />
      </label>
      {uploadErr && <div style={styles.err}>{uploadErr}</div>}
      {attachments.length > 0 && (
        <div style={styles.attachList}>
          {attachments.map((att) => (
            <div key={att.site} style={styles.attachRow}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={styles.attachName}>{att.filename}</div>
                <div style={styles.attachMeta}>
                  {(att.size / 1024).toFixed(1)} KB · {att.content_type ?? 'unknown'} · {new Date(att.ts).toLocaleString()}
                </div>
              </div>
              <button style={styles.linkBtn} onClick={() => downloadAttachment(att)}>↓</button>
              <button style={styles.linkBtnDanger} onClick={() => removeAttachment(att)}>×</button>
            </div>
          ))}
        </div>
      )}
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
  fileBtn: {
    display: 'inline-block', padding: '8px 14px', background: 'transparent',
    color: '#6ee7b7', border: '1px dashed #2d6e54', borderRadius: 4,
    fontSize: 12, cursor: 'pointer', fontFamily: 'ui-monospace, monospace',
    textAlign: 'center' as const,
  },
  attachList: { display: 'flex', flexDirection: 'column', gap: 4 },
  attachRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: 8,
    background: '#1c1c22', border: '1px solid #2a2a33', borderRadius: 4,
  },
  attachName: { color: '#e0e0e6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  attachMeta: { color: '#7a7a88', fontSize: 10 },
  linkBtn: {
    background: 'transparent', border: '1px solid #2a2a33', color: '#6ee7b7',
    padding: '4px 8px', borderRadius: 4, fontSize: 14, cursor: 'pointer',
    fontFamily: 'ui-monospace, monospace',
  },
  linkBtnDanger: {
    background: 'transparent', border: '1px solid #2a2a33', color: '#f87171',
    padding: '4px 8px', borderRadius: 4, fontSize: 14, cursor: 'pointer',
    fontFamily: 'ui-monospace, monospace',
  },
};
