import { useState } from 'react';
import { login as loginRest } from '../matrix/rest';
import type { Session } from '../matrix/rest';

interface Props {
  onSession(s: Session): void;
}

export function Login({ onSession }: Props) {
  const [homeserver, setHomeserver] = useState('https://app.aminoimmigration.com');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const s = await loginRest(homeserver, username, password);
      onSession(s);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={submit} style={styles.card}>
        <h1 style={styles.title}>EO///DB</h1>
        <p style={styles.subtitle}>Sign in to your Matrix account</p>

        <label style={styles.label}>Homeserver</label>
        <input
          style={styles.input}
          type="url"
          value={homeserver}
          onChange={(e) => setHomeserver(e.target.value)}
          required
        />

        <label style={styles.label}>Username</label>
        <input
          style={styles.input}
          type="text"
          autoComplete="username"
          placeholder="mlacy"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label style={styles.label}>Password</label>
        <input
          style={styles.input}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div style={styles.error}>{error}</div>}

        <button style={styles.button} disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0c0c0e', fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    width: 360, padding: 32, background: '#141418', border: '1px solid #2a2a33',
    borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12,
  },
  title: { color: '#6ee7b7', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 18, margin: 0 },
  subtitle: { color: '#7a7a88', fontSize: 13, margin: 0, marginBottom: 8 },
  label: { color: '#7a7a88', fontSize: 11, fontFamily: 'ui-monospace, monospace', marginBottom: -8, marginTop: 4 },
  input: {
    background: '#1c1c22', border: '1px solid #2a2a33', borderRadius: 4,
    color: '#e0e0e6', padding: '8px 10px', fontSize: 13, fontFamily: 'ui-monospace, monospace',
  },
  button: {
    marginTop: 12, padding: '10px 14px', background: '#2d6e54', color: '#6ee7b7',
    border: '1px solid #6ee7b7', borderRadius: 4, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'ui-monospace, monospace',
  },
  error: { color: '#f87171', fontSize: 12, padding: 8, background: '#2a1414', borderRadius: 4 },
};
