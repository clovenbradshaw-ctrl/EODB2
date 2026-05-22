/**
 * Raw Matrix REST helpers. Mirrors the sanity-check flow exactly — no SDK,
 * no encryption, no /sync long-poll abstraction. Just authenticated fetch.
 */

export interface Session {
  homeserver: string;   // e.g. https://app.aminoimmigration.com
  userId: string;       // @localpart:server
  deviceId: string;
  accessToken: string;
}

export class MatrixError extends Error {
  constructor(public status: number, public errcode: string | undefined, message: string) {
    super(message);
    this.name = 'MatrixError';
  }
}

/**
 * Authenticated JSON request to the v3 client API.
 *
 * Caller passes the path *after* `/_matrix/client/v3` (e.g. `/login`,
 * `/rooms/{id}/send/{type}/{txn}`). Body is JSON-stringified when an object
 * is given; binary bodies must use the media helpers below.
 */
export async function mx<T = any>(
  session: Pick<Session, 'homeserver' | 'accessToken'> | null,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (session?.accessToken) headers['Authorization'] = 'Bearer ' + session.accessToken;
  const init: RequestInit = { method, headers };
  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const url = (session?.homeserver ?? '').replace(/\/+$/, '') + '/_matrix/client/v3' + path;
  const resp = await fetch(url, init);
  const text = await resp.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!resp.ok) {
    throw new MatrixError(
      resp.status,
      data?.errcode,
      data?.error || data?.errcode || resp.statusText || `HTTP ${resp.status}`,
    );
  }
  return data as T;
}

/**
 * Authenticated media upload/download. Tries the new authenticated
 * `/_matrix/client/v1/media` first (Synapse 1.98+), falls back to legacy
 * `/_matrix/media/v3`. Returns a `Response` for downloads so the caller
 * can stream or hash without an extra buffer copy.
 */
const MEDIA_PATHS = [
  '/_matrix/client/v1/media',
  '/_matrix/media/v3',
] as const;

export async function uploadMedia(
  session: Pick<Session, 'homeserver' | 'accessToken'>,
  data: Uint8Array,
  contentType: string,
  filename?: string,
): Promise<{ content_uri: string }> {
  const base = session.homeserver.replace(/\/+$/, '');
  const qs = filename ? `?filename=${encodeURIComponent(filename)}` : '';
  let lastErr: string | null = null;
  for (const path of MEDIA_PATHS) {
    try {
      const resp = await fetch(base + path + '/upload' + qs, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.accessToken,
          'Content-Type': contentType,
        },
        body: data as BodyInit,
      });
      if (resp.ok) return (await resp.json()) as { content_uri: string };
      const errText = await resp.text();
      lastErr = `${path} → ${resp.status}: ${errText.slice(0, 200)}`;
    } catch (e: any) {
      lastErr = `${path} → ${e?.message ?? e}`;
    }
  }
  throw new Error('All media upload endpoints failed: ' + lastErr);
}

/**
 * Download an mxc:// URI as a `Response` (caller handles `.blob()` /
 * `.arrayBuffer()`). Same authenticated→legacy fallback as upload.
 */
export async function downloadMedia(
  session: Pick<Session, 'homeserver' | 'accessToken'>,
  mxcUri: string,
): Promise<Response> {
  const m = mxcUri.match(/^mxc:\/\/([^/]+)\/(.+)$/);
  if (!m) throw new Error('Invalid mxc:// URI: ' + mxcUri);
  const [, server, mediaId] = m;
  const base = session.homeserver.replace(/\/+$/, '');
  const subpath = `/download/${encodeURIComponent(server)}/${encodeURIComponent(mediaId)}`;
  let lastErr: string | null = null;
  for (const path of MEDIA_PATHS) {
    try {
      const resp = await fetch(base + path + subpath, {
        headers: { Authorization: 'Bearer ' + session.accessToken },
      });
      if (resp.ok) return resp;
      lastErr = `${path} → ${resp.status}`;
    } catch (e: any) {
      lastErr = `${path} → ${e?.message ?? e}`;
    }
  }
  throw new Error('All media download endpoints failed: ' + lastErr);
}

// ── Auth ──────────────────────────────────────────────────────────────────

export async function login(
  homeserver: string,
  username: string,
  password: string,
): Promise<Session> {
  const hs = homeserver.replace(/\/+$/, '');
  // Accept either `@localpart:server` or bare `localpart`. The Matrix
  // identifier just wants the localpart on m.id.user.
  const localpart = username.replace(/^@/, '').split(':')[0]!;
  const data = await mx<{ access_token: string; user_id: string; device_id: string }>(
    { homeserver: hs, accessToken: '' },
    'POST',
    '/login',
    {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: localpart },
      password,
      initial_device_display_name: 'EO///DB',
    },
  );
  return {
    homeserver: hs,
    userId: data.user_id,
    deviceId: data.device_id,
    accessToken: data.access_token,
  };
}

export async function whoami(session: Session): Promise<{ user_id: string }> {
  return mx(session, 'GET', '/account/whoami');
}

export async function logout(session: Session): Promise<void> {
  await mx(session, 'POST', '/logout', {});
}

// ── Rooms ────────────────────────────────────────────────────────────────

export async function resolveAlias(
  session: Session,
  alias: string,
): Promise<string | null> {
  try {
    const data = await mx<{ room_id: string }>(
      session,
      'GET',
      '/directory/room/' + encodeURIComponent(alias),
    );
    return data.room_id;
  } catch (e) {
    if (e instanceof MatrixError && e.status === 404) return null;
    throw e;
  }
}

export async function joinRoom(session: Session, roomIdOrAlias: string): Promise<string> {
  const data = await mx<{ room_id: string }>(
    session,
    'POST',
    '/join/' + encodeURIComponent(roomIdOrAlias),
    {},
  );
  return data.room_id;
}

export async function createRoom(
  session: Session,
  opts: { aliasLocalpart?: string; name?: string; topic?: string },
): Promise<string> {
  const data = await mx<{ room_id: string }>(session, 'POST', '/createRoom', {
    room_alias_name: opts.aliasLocalpart,
    name: opts.name,
    topic: opts.topic,
    preset: 'private_chat',
    creation_content: { 'm.federate': false },
  });
  return data.room_id;
}

// ── Events ───────────────────────────────────────────────────────────────

/**
 * PUT an event into a room. The txn ID must be unique per device — using a
 * monotonic counter + entropy keeps Matrix's server-side dedup happy.
 */
export async function sendEvent(
  session: Session,
  roomId: string,
  type: string,
  content: unknown,
  txnId: string,
): Promise<{ event_id: string }> {
  return mx(
    session,
    'PUT',
    `/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(type)}/${encodeURIComponent(txnId)}`,
    content,
  );
}

export interface MessagesPage {
  start: string;
  end?: string;
  chunk: MatrixTimelineEvent[];
}

export interface MatrixTimelineEvent {
  type: string;
  event_id: string;
  sender: string;
  origin_server_ts: number;
  content: any;
  state_key?: string;
}

/**
 * Paginate the room timeline backwards. Returns one page; caller drives
 * the loop by re-calling with the previous `end` token.
 */
export async function getMessages(
  session: Session,
  roomId: string,
  opts: { from?: string; limit?: number; dir?: 'b' | 'f' } = {},
): Promise<MessagesPage> {
  const params = new URLSearchParams();
  params.set('dir', opts.dir ?? 'b');
  params.set('limit', String(opts.limit ?? 100));
  if (opts.from) params.set('from', opts.from);
  return mx(
    session,
    'GET',
    `/rooms/${encodeURIComponent(roomId)}/messages?${params.toString()}`,
  );
}

let txnCounter = Date.now();
export function nextTxnId(): string {
  return 'eo_' + (txnCounter++).toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ── /sync long-poll ──────────────────────────────────────────────────────

/**
 * Subscribe to live timeline updates for a single room via Matrix `/sync`
 * long-polling. The first call uses an initial-sync filter that asks for
 * exactly one room, no presence, no account data, no to-device. Subsequent
 * calls pass the `next_batch` token and a 30-second timeout, so each call
 * blocks until the server has something to deliver or the timeout elapses.
 *
 * Returns an `unsubscribe()` — sets a stop flag the next loop iteration
 * checks. In-flight long-polls are NOT aborted; they'll time out on their
 * own within `timeout` ms.
 *
 * `onEvents` is called with the room's timeline events for each `/sync`
 * tick. Events may include the caller's own echoes — the store dedups by
 * `event_id`.
 */
export function subscribeRoom(
  session: Session,
  roomId: string,
  onEvents: (events: MatrixTimelineEvent[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  let stopped = false;
  let since: string | undefined = undefined;
  const filter = JSON.stringify({
    room: {
      rooms: [roomId],
      timeline: { limit: 50 },
      state: { types: [] },
      ephemeral: { types: [] },
      account_data: { types: [] },
    },
    presence: { types: [] },
    account_data: { types: [] },
  });

  (async function loop() {
    while (!stopped) {
      try {
        const params = new URLSearchParams();
        params.set('filter', filter);
        if (since) {
          params.set('since', since);
          params.set('timeout', '30000');
        }
        const data = await mx<SyncResponse>(session, 'GET', '/sync?' + params.toString());
        since = data.next_batch;
        const room = data.rooms?.join?.[roomId];
        const events = room?.timeline?.events ?? [];
        if (events.length > 0 && !stopped) onEvents(events);
      } catch (e) {
        if (stopped) break;
        onError?.(e);
        // Back off briefly before retrying so a sustained failure doesn't
        // hammer the server.
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  })();

  return () => { stopped = true; };
}

interface SyncResponse {
  next_batch: string;
  rooms?: {
    join?: Record<string, { timeline?: { events?: MatrixTimelineEvent[] } }>;
  };
}
