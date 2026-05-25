import { useCallback, useEffect, useRef, useState } from 'react';
import {
  login,
  logout,
  restoreSession,
  setProgress,
  setRecoveryKeyDisplayer,
  setRecoveryKeyProvider,
  getClient,
} from './foundation/client.js';
import { Login } from './components/Login';
import { MainShell } from './components/MainShell';
import { RecoveryDisplayModal, RecoveryEntryModal } from './components/RecoveryModals';
import { Log } from './components/Log';

type Phase = 'initializing' | 'logged_out' | 'logging_in' | 'active';
type LogEntry = { id: number; level: 'info' | 'error'; msg: string };

let nextLogId = 1;

export function App() {
  const [phase, setPhase] = useState<Phase>('initializing');
  const [user, setUser] = useState<{ userId: string; deviceId: string } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [displayKey, setDisplayKey] = useState<{
    key: string;
    resolve: () => void;
  } | null>(null);
  const [entryRequest, setEntryRequest] = useState<{
    resolve: (v: string | null) => void;
  } | null>(null);

  const append = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    setLogs((prev) => {
      const next = [...prev, { id: nextLogId++, level, msg }];
      return next.length > 60 ? next.slice(next.length - 60) : next;
    });
  }, []);

  // Wire foundation callbacks once. The progress hook drives the log panel;
  // the recovery-key hooks open modals and resolve when the user dismisses.
  const calledRef = useRef(false);
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    setProgress((msg) => append(msg));
    setRecoveryKeyDisplayer(
      (key) =>
        new Promise<void>((resolve) => {
          setDisplayKey({ key, resolve });
        }),
    );
    setRecoveryKeyProvider(
      () =>
        new Promise<string | null>((resolve) => {
          setEntryRequest({ resolve });
        }),
    );

    void (async () => {
      try {
        const c = await restoreSession();
        if (c) {
          setUser({ userId: c.getUserId() ?? '', deviceId: c.getDeviceId() ?? '' });
          setPhase('active');
        } else {
          setPhase('logged_out');
        }
      } catch (e) {
        append(e instanceof Error ? e.message : String(e), 'error');
        setPhase('logged_out');
      }
    })();
  }, [append]);

  const handleLogin = useCallback(
    async (homeserver: string, username: string, password: string) => {
      setPhase('logging_in');
      try {
        const res = await login(homeserver, username, password);
        setUser({ userId: res.userId, deviceId: res.deviceId });
        setPhase('active');
      } catch (e) {
        append(e instanceof Error ? e.message : String(e), 'error');
        setPhase('logged_out');
      }
    },
    [append],
  );

  const handleLogout = useCallback(async () => {
    await logout();
    setUser(null);
    setPhase('logged_out');
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          EO<span className="dim">///</span>DB
        </h1>
        <span className="tag">rooms as tables · events as rows · fold as query</span>
        {phase === 'active' && user && (
          <div className="header-right">
            <span className="user">{user.userId}</span>
            <button className="ghost" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </header>

      <Log entries={logs} />

      {phase === 'initializing' && <div className="boot">Restoring session…</div>}

      {phase === 'logged_out' && <Login onSubmit={handleLogin} />}

      {phase === 'logging_in' && <div className="boot">Connecting…</div>}

      {phase === 'active' && user && (
        <MainShell userId={user.userId} client={getClient()} onLog={append} />
      )}

      {displayKey && (
        <RecoveryDisplayModal
          recoveryKey={displayKey.key}
          onAcknowledge={() => {
            const { resolve } = displayKey;
            setDisplayKey(null);
            resolve();
          }}
        />
      )}

      {entryRequest && (
        <RecoveryEntryModal
          onSubmit={(value) => {
            const { resolve } = entryRequest;
            setEntryRequest(null);
            resolve(value);
          }}
        />
      )}
    </div>
  );
}
