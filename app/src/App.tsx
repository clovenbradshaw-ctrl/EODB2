import { useEffect, useState } from 'react';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import type { Session } from './matrix/rest';
import { whoami } from './matrix/rest';
import { loadSession, saveSession, clearSession } from './lib/session';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  // Restore session on boot and verify the token is still valid.
  useEffect(() => {
    const restored = loadSession();
    if (!restored) { setChecking(false); return; }
    (async () => {
      try {
        await whoami(restored);
        setSession(restored);
      } catch {
        clearSession();
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  function onSession(s: Session) {
    saveSession(s);
    setSession(s);
  }

  function onLogout() {
    setSession(null);
  }

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0c0c0e', color: '#7a7a88', fontFamily: 'ui-monospace, monospace' }}>
        Loading…
      </div>
    );
  }

  if (!session) return <Login onSession={onSession} />;
  return <Layout session={session} onLogout={onLogout} />;
}
