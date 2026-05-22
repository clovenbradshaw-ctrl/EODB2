import { useEffect, useState } from 'react';
import { useEoStore } from '../store/eo-store';
import {
  resolveAlias,
  joinRoom,
  createRoom,
  MatrixError,
  type Session,
} from '../matrix/rest';
import { CollectionSidebar } from './CollectionSidebar';
import { RecordList } from './RecordList';
import { RecordDrawer } from './RecordDrawer';
import { clearSession } from '../lib/session';

interface Props {
  session: Session;
  onLogout(): void;
}

/**
 * One canonical room per user. Lives in localStorage as
 * `eodb2_room_id:<userId>`. On first run we try to join (or create) the
 * canonical alias `#eodb2-{localpart}:{homeserver}`.
 */
function roomKey(userId: string) { return `eodb2_room_id:${userId}`; }
function defaultAlias(session: Session): string {
  const localpart = session.userId.replace(/^@/, '').split(':')[0];
  const server = session.homeserver.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `#eodb2-${localpart}:${server}`;
}

export function Layout({ session, onLogout }: Props) {
  const { roomId, setRoom, setSession, hydrate, hydrating, hydrated, hydrateError, reset } = useEoStore();
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  // Wire session + resolve room once on mount.
  useEffect(() => {
    setSession(session);
    const stored = localStorage.getItem(roomKey(session.userId));
    if (stored) {
      setRoom(stored);
      return;
    }
    const alias = defaultAlias(session);
    (async () => {
      try {
        let rid = await resolveAlias(session, alias);
        if (!rid) {
          // Alias doesn't exist; create the room with that alias.
          rid = await createRoom(session, {
            aliasLocalpart: alias.split(':')[0]!.replace(/^#/, ''),
            name: 'EO///DB',
            topic: 'EO///DB record room',
          });
        } else {
          await joinRoom(session, rid);
        }
        localStorage.setItem(roomKey(session.userId), rid);
        setRoom(rid);
      } catch (e) {
        const msg = e instanceof MatrixError ? `${e.status} ${e.message}` : String((e as any)?.message ?? e);
        setResolveError(msg);
      }
    })();
  }, [session, setSession, setRoom]);

  // Cold-start hydrate once a room is known.
  useEffect(() => {
    if (!roomId) return;
    void hydrate();
  }, [roomId, hydrate]);

  function logout() {
    reset();
    clearSession();
    onLogout();
  }

  return (
    <div style={styles.shell}>
      <header style={styles.topBar}>
        <div style={styles.brand}>EO///DB</div>
        <div style={styles.userInfo}>
          <span style={styles.userId}>{session.userId}</span>
          <button style={styles.linkBtn} onClick={logout}>Sign out</button>
        </div>
      </header>

      <div style={styles.body}>
        <CollectionSidebar
          selected={selectedCollection}
          onSelect={(c) => { setSelectedCollection(c); setSelectedSite(null); }}
        />

        <main style={styles.main}>
          {resolveError && <div style={styles.error}>Room resolve failed: {resolveError}</div>}
          {hydrateError && <div style={styles.error}>Hydrate failed: {hydrateError}</div>}
          {!roomId && !resolveError && <div style={styles.status}>Resolving room…</div>}
          {roomId && hydrating && !hydrated && <div style={styles.status}>Hydrating from Matrix…</div>}
          {roomId && hydrated && (
            <RecordList
              collection={selectedCollection}
              onOpen={(site) => setSelectedSite(site)}
            />
          )}
        </main>

        {selectedSite && (
          <RecordDrawer site={selectedSite} onClose={() => setSelectedSite(null)} />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    background: '#0c0c0e', color: '#e0e0e6',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  topBar: {
    height: 48, padding: '0 16px', borderBottom: '1px solid #2a2a33',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#141418',
  },
  brand: { color: '#6ee7b7', fontFamily: 'ui-monospace, monospace', fontWeight: 600, fontSize: 14 },
  userInfo: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#7a7a88' },
  userId: { fontFamily: 'ui-monospace, monospace' },
  linkBtn: {
    background: 'transparent', border: '1px solid #2a2a33', color: '#7a7a88',
    padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
    fontFamily: 'ui-monospace, monospace',
  },
  body: { flex: 1, display: 'flex', minHeight: 0 },
  main: { flex: 1, minWidth: 0, padding: 16, overflow: 'auto' },
  status: { color: '#7a7a88', fontFamily: 'ui-monospace, monospace', fontSize: 13, padding: 16 },
  error: { color: '#f87171', fontSize: 13, padding: 12, background: '#2a1414', borderRadius: 4, marginBottom: 12 },
};
