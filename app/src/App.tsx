import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getClient,
  hasLocalAccount,
  lock,
  login,
  logout,
  restoreSession,
  setProgress,
  setRecoveryKeyDisplayer,
  setRecoveryKeyProvider,
  unlock,
} from './foundation/client.js';
import { vault, getLastUser } from './foundation/vault.js';
import {
  OutboxFlusher,
  onChange as onOutboxChange,
  pendingCount,
} from './foundation/outbox.js';
import {
  getNetworkState,
  onNetworkChange,
  type NetworkState,
} from './foundation/network.js';
import { Login } from './components/Login';
import { Unlock } from './components/Unlock';
import { MainShell } from './components/MainShell';
import { RecoveryDisplayModal, RecoveryEntryModal } from './components/RecoveryModals';
import { Log } from './components/Log';

type Phase = 'initializing' | 'unlock_form' | 'login_form' | 'connecting' | 'active';
type LogEntry = { id: number; level: 'info' | 'error'; msg: string };

let nextLogId = 1;

export function App() {
  const [phase, setPhase] = useState<Phase>('initializing');
  const [user, setUser] = useState<{ userId: string; deviceId: string } | null>(null);
  const [lastUser, setLastUser] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [network, setNetwork] = useState<NetworkState>(getNetworkState());
  const [pending, setPending] = useState<number>(0);
  const [displayKey, setDisplayKey] = useState<{
    key: string;
    resolve: () => void;
  } | null>(null);
  const [entryRequest, setEntryRequest] = useState<{
    resolve: (v: string | null) => void;
  } | null>(null);

  const flusherRef = useRef<OutboxFlusher | null>(null);
  const wired = useRef(false);

  const append = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    setLogs((prev) => {
      const next = [...prev, { id: nextLogId++, level, msg }];
      return next.length > 60 ? next.slice(next.length - 60) : next;
    });
  }, []);

  // One-time wiring of foundation callbacks + boot decision.
  useEffect(() => {
    if (wired.current) return;
    wired.current = true;

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

    const last = getLastUser();
    setLastUser(last);
    if (last && hasLocalAccount(last)) {
      setPhase('unlock_form');
    } else {
      setPhase('login_form');
    }
  }, [append]);

  // Vault state surface. Lock event → return to unlock screen.
  useEffect(() => {
    return vault.onChange((evt) => {
      if (!evt.unlocked && phase === 'active') {
        setUser(null);
        setLastUser(evt.userId ?? getLastUser());
        setPhase('unlock_form');
      }
    });
  }, [phase]);

  // Network + outbox surfacing only matter while we have a session.
  useEffect(() => {
    if (phase !== 'active') return;
    setNetwork(getNetworkState());
    const unsubNet = onNetworkChange((s) => {
      setNetwork(s);
      if (s === 'online') flusherRef.current?.kick();
    });
    const refreshPending = () => {
      pendingCount().then(setPending).catch(() => {});
    };
    refreshPending();
    const unsubOutbox = onOutboxChange(refreshPending);
    return () => {
      unsubNet();
      unsubOutbox();
    };
  }, [phase]);

  // Outbox flusher runs while active. It pulls the in-scope client on every
  // tick, so a brief disconnect doesn't break it.
  useEffect(() => {
    if (phase !== 'active') return;
    const flusher = new OutboxFlusher({
      getClient: () => getClient(),
      onProgress: (e) => {
        if (e.type === 'dead') append(`Send failed: ${e.error}`, 'error');
      },
    });
    flusherRef.current = flusher;
    flusher.start();
    return () => {
      flusher.stop();
      flusherRef.current = null;
    };
  }, [phase, append]);

  const enterActive = useCallback(
    (userId: string, deviceId: string) => {
      setUser({ userId, deviceId });
      setLastUser(userId);
      setPhase('active');
    },
    [],
  );

  const handleLogin = useCallback(
    async (homeserver: string, username: string, password: string) => {
      setPhase('connecting');
      try {
        const res = await login(homeserver, username, password);
        enterActive(res.userId, res.deviceId);
      } catch (e) {
        append(e instanceof Error ? e.message : String(e), 'error');
        setPhase('login_form');
      }
    },
    [append, enterActive],
  );

  const handleUnlock = useCallback(
    async (userId: string, password: string) => {
      setPhase('connecting');
      try {
        await unlock(userId, password);
        const c = getClient();
        if (!c) {
          // Vault unlocked but no saved session — fall back to full login.
          append('No saved session for this user — please log in.', 'error');
          setPhase('login_form');
          return;
        }
        enterActive(c.getUserId() ?? userId, c.getDeviceId() ?? '');
      } catch (e) {
        append(e instanceof Error ? e.message : String(e), 'error');
        setPhase('unlock_form');
      }
    },
    [append, enterActive],
  );

  const handleSwitchAccount = useCallback(() => {
    setPhase('login_form');
  }, []);

  const handleLock = useCallback(async () => {
    await lock();
    // vault.onChange listener will route back to unlock_form.
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setUser(null);
    setLastUser(null);
    setPhase('login_form');
  }, []);

  // Restore a still-unlocked vault on hot reload (e.g. dev mode).
  useEffect(() => {
    if (phase !== 'initializing') return;
    if (!vault.isUnlocked()) return;
    const uid = vault.getUserId();
    if (!uid) return;
    void (async () => {
      const c = await restoreSession(uid);
      if (c) enterActive(c.getUserId() ?? uid, c.getDeviceId() ?? '');
    })();
  }, [phase, enterActive]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          EO<span className="dim">///</span>DB
        </h1>
        <span className="tag">rooms as tables · events as rows · fold as query</span>
        {phase === 'active' && user && (
          <div className="header-right">
            <NetworkBadge state={network} pending={pending} />
            <span className="user">{user.userId}</span>
            <button className="ghost" onClick={handleLock}>
              Lock
            </button>
            <button className="ghost" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </header>

      <Log entries={logs} />

      {phase === 'initializing' && <div className="boot">Starting…</div>}

      {phase === 'login_form' && <Login onSubmit={handleLogin} />}

      {phase === 'unlock_form' && lastUser && (
        <Unlock
          userId={lastUser}
          onSubmit={handleUnlock}
          onSwitchAccount={handleSwitchAccount}
        />
      )}

      {phase === 'connecting' && <div className="boot">Connecting…</div>}

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

function NetworkBadge({ state, pending }: { state: NetworkState; pending: number }) {
  const label = state === 'online' ? '● online' : state === 'degraded' ? '● degraded' : '● offline';
  return (
    <span className={`net-badge ${state}`} title={`${pending} queued`}>
      {label}
      {pending > 0 && <span className="net-pending">{pending}</span>}
    </span>
  );
}
