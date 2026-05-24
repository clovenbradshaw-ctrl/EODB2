/**
 * Matrix client surface.
 *
 * Was raw fetch; now a thin adapter over `matrix-js-sdk` so we get Olm /
 * Megolm E2EE for free. Existing call sites continue to import the same
 * functions (`login`, `sendEvent`, `subscribeRoom`, etc.) — under the hood
 * everything routes through a single SDK client (see `./client.ts`).
 *
 * The `Session` shape and the timeline event shape are preserved so the
 * store / projection engine / Layout don't change. Inside encrypted rooms
 * the SDK transparently encrypts on send and decrypts on receive; the
 * timeline events we hand to callers carry the decrypted type and content.
 */

import * as sdk from 'matrix-js-sdk';
import { ClientEvent, MatrixEventEvent, RoomEvent } from 'matrix-js-sdk';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import {
  encryptAttachment,
  decryptAttachment,
  type IEncryptedFile,
} from 'matrix-encrypt-attachment';
import { getClient } from './client';

export interface Session {
  homeserver: string;
  userId: string;
  deviceId: string;
  accessToken: string;
}

export class MatrixError extends Error {
  constructor(public status: number, public errcode: string | undefined, message: string) {
    super(message);
    this.name = 'MatrixError';
  }
}

function adaptError(e: unknown): MatrixError {
  if (e instanceof MatrixError) return e;
  if (e instanceof sdk.MatrixError) {
    return new MatrixError(e.httpStatus ?? 0, e.errcode, e.data?.error || e.message);
  }
  if (e instanceof Error) return new MatrixError(0, undefined, e.message);
  return new MatrixError(0, undefined, String(e));
}

// ── Auth ──────────────────────────────────────────────────────────────────

export async function login(
  homeserver: string,
  username: string,
  password: string,
): Promise<Session> {
  const hs = homeserver.replace(/\/+$/, '');
  const localpart = username.replace(/^@/, '').split(':')[0]!;
  const tmp = sdk.createClient({ baseUrl: hs });
  try {
    const r = await tmp.login('m.login.password', {
      identifier: { type: 'm.id.user', user: localpart },
      password,
      initial_device_display_name: 'EO///DB',
    });
    return {
      homeserver: hs,
      userId: r.user_id,
      deviceId: r.device_id,
      accessToken: r.access_token,
    };
  } catch (e) {
    throw adaptError(e);
  }
}

export async function whoami(session: Session): Promise<{ user_id: string }> {
  const c = await getClient(session);
  try {
    const r = await c.whoami();
    return { user_id: r.user_id };
  } catch (e) {
    throw adaptError(e);
  }
}

export async function logout(session: Session): Promise<void> {
  const c = await getClient(session);
  try {
    await c.logout(true);
  } catch (e) {
    throw adaptError(e);
  }
}

// ── Rooms ────────────────────────────────────────────────────────────────

export async function resolveAlias(
  session: Session,
  alias: string,
): Promise<string | null> {
  const c = await getClient(session);
  try {
    const r = await c.getRoomIdForAlias(alias);
    return r.room_id;
  } catch (e) {
    if (e instanceof sdk.MatrixError && e.httpStatus === 404) return null;
    throw adaptError(e);
  }
}

export async function joinRoom(session: Session, roomIdOrAlias: string): Promise<string> {
  const c = await getClient(session);
  try {
    const r = await c.joinRoom(roomIdOrAlias);
    return r.roomId;
  } catch (e) {
    throw adaptError(e);
  }
}

export async function createRoom(
  session: Session,
  opts: { aliasLocalpart?: string; name?: string; topic?: string },
): Promise<string> {
  const c = await getClient(session);
  try {
    const r = await c.createRoom({
      room_alias_name: opts.aliasLocalpart,
      name: opts.name,
      topic: opts.topic,
      preset: sdk.Preset.PrivateChat,
      creation_content: { 'm.federate': false },
      initial_state: [
        {
          type: 'm.room.encryption',
          state_key: '',
          content: { algorithm: 'm.megolm.v1.aes-sha2' },
        },
      ],
    });
    return r.room_id;
  } catch (e) {
    throw adaptError(e);
  }
}

export async function inviteUser(
  session: Session,
  roomId: string,
  userId: string,
): Promise<void> {
  const c = await getClient(session);
  try {
    await c.invite(roomId, userId);
  } catch (e) {
    throw adaptError(e);
  }
}

// ── Events ───────────────────────────────────────────────────────────────

export async function sendEvent(
  session: Session,
  roomId: string,
  type: string,
  content: unknown,
  txnId: string,
): Promise<{ event_id: string }> {
  const c = await getClient(session);
  try {
    const r = await c.sendEvent(roomId, null, type as any, content as Record<string, any>, txnId);
    return { event_id: r.event_id };
  } catch (e) {
    throw adaptError(e);
  }
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

function rawToTimelineEvent(raw: any): MatrixTimelineEvent {
  return {
    type: raw.type,
    event_id: raw.event_id,
    sender: raw.sender,
    origin_server_ts: raw.origin_server_ts,
    content: raw.content,
    state_key: raw.state_key,
  };
}

function sdkEventToTimelineEvent(ev: MatrixEvent): MatrixTimelineEvent {
  return {
    type: ev.getType(),
    event_id: ev.getId()!,
    sender: ev.getSender()!,
    origin_server_ts: ev.getTs(),
    content: ev.getContent(),
    state_key: ev.getStateKey(),
  };
}

export async function getMessages(
  session: Session,
  roomId: string,
  opts: { from?: string; limit?: number; dir?: 'b' | 'f' } = {},
): Promise<MessagesPage> {
  const c = await getClient(session);
  try {
    const dir = (opts.dir ?? 'b') as sdk.Direction;
    const r = await c.createMessagesRequest(
      roomId,
      opts.from ?? null,
      opts.limit ?? 100,
      dir,
    );
    return {
      start: r.start ?? '',
      end: r.end,
      chunk: (r.chunk ?? []).map(rawToTimelineEvent),
    };
  } catch (e) {
    throw adaptError(e);
  }
}

let txnCounter = Date.now();
export function nextTxnId(): string {
  return 'eo_' + (txnCounter++).toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ── Live timeline subscription ───────────────────────────────────────────

/**
 * Subscribe to live timeline events in a room. Delivered events are already
 * decrypted by the SDK; events that fail decryption are skipped — they will
 * re-emit via `Event.decrypted` once the room key arrives. The store dedups
 * by `event_id`, so callers can safely receive the same event twice.
 */
export function subscribeRoom(
  session: Session,
  roomId: string,
  onEvents: (events: MatrixTimelineEvent[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  let stopped = false;
  let detach: () => void = () => {};
  (async () => {
    try {
      const c = await getClient(session);
      if (stopped) return;
      const onTimeline = (
        event: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline?: boolean,
      ) => {
        if (stopped || toStartOfTimeline) return;
        if (room?.roomId !== roomId) return;
        if (event.isDecryptionFailure()) return;
        onEvents([sdkEventToTimelineEvent(event)]);
      };
      const onDecrypted = (event: MatrixEvent) => {
        if (stopped) return;
        if (event.getRoomId() !== roomId) return;
        if (event.isDecryptionFailure()) return;
        onEvents([sdkEventToTimelineEvent(event)]);
      };
      c.on(RoomEvent.Timeline, onTimeline);
      c.on(MatrixEventEvent.Decrypted, onDecrypted);
      detach = () => {
        c.off(RoomEvent.Timeline, onTimeline);
        c.off(MatrixEventEvent.Decrypted, onDecrypted);
      };
      // Drive a sync-state check so any one-time onError can fire on a
      // persistent network failure (the SDK retries internally otherwise).
      const onSync = (state: string) => {
        if (state === 'ERROR') onError?.(new MatrixError(0, undefined, 'sync error'));
      };
      c.on(ClientEvent.Sync, onSync);
      const prevDetach = detach;
      detach = () => {
        prevDetach();
        c.off(ClientEvent.Sync, onSync);
      };
    } catch (e) {
      if (!stopped) onError?.(adaptError(e));
    }
  })();
  return () => {
    stopped = true;
    detach();
  };
}

// ── Media ────────────────────────────────────────────────────────────────

/**
 * `EncryptedFile` shape as stored in event content per the Matrix spec —
 * the upload helper returns this with `url` populated to the mxc:// URI
 * the server returned. Caller persists it as the source of truth for the
 * attachment (key + iv + hashes + url).
 */
export type EncryptedFile = IEncryptedFile & { url: string };

/**
 * Encrypt and upload an attachment. The plaintext bytes are AES-CTR
 * encrypted in the browser (per matrix.org's encrypted-attachments spec)
 * before being POSTed to the media repo, so the homeserver only ever sees
 * ciphertext. Returns both the mxc URI and the full `EncryptedFile`
 * metadata (key, iv, hashes) — store the metadata in the event content
 * and pass it to `downloadEncryptedMedia` to decrypt later.
 */
export async function uploadMedia(
  session: Session,
  data: Uint8Array,
  contentType: string,
  filename?: string,
): Promise<{ content_uri: string; file: EncryptedFile }> {
  void contentType; // ciphertext is opaque; stored content_type lives in the event content
  const c = await getClient(session);
  try {
    const plaintext = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
    const { data: ciphertext, info } = await encryptAttachment(plaintext);
    // The ciphertext is opaque bytes — Matrix media repos don't care about
    // the declared content-type but we send octet-stream to make the
    // server-side opacity explicit. The original content_type is preserved
    // separately in the event content by the caller.
    const blob = new Blob([ciphertext as BlobPart], {
      type: 'application/octet-stream',
    });
    const r = await c.uploadContent(blob, {
      type: 'application/octet-stream',
      name: filename,
    });
    return {
      content_uri: r.content_uri,
      file: { ...info, url: r.content_uri },
    };
  } catch (e) {
    throw adaptError(e);
  }
}

/**
 * Download an attachment via raw mxc URI (plaintext). Kept for backward
 * compatibility with attachments uploaded before encrypted media landed.
 */
export async function downloadMedia(
  session: Session,
  mxcUri: string,
): Promise<Response> {
  const c = await getClient(session);
  const httpUrl = c.mxcUrlToHttp(mxcUri, undefined, undefined, undefined, undefined, true, true);
  if (!httpUrl) throw new MatrixError(0, undefined, 'Invalid mxc:// URI: ' + mxcUri);
  const resp = await fetch(httpUrl, {
    headers: { Authorization: 'Bearer ' + session.accessToken },
  });
  if (!resp.ok) throw new MatrixError(resp.status, undefined, resp.statusText);
  return resp;
}

/**
 * Fetch an encrypted attachment by its `EncryptedFile` metadata and
 * decrypt it client-side. Returns a Response wrapping the decrypted bytes
 * so callers can `.blob()` it identically to `downloadMedia`.
 */
export async function downloadEncryptedMedia(
  session: Session,
  file: EncryptedFile,
  contentType?: string,
): Promise<Response> {
  const c = await getClient(session);
  const httpUrl = c.mxcUrlToHttp(file.url, undefined, undefined, undefined, undefined, true, true);
  if (!httpUrl) throw new MatrixError(0, undefined, 'Invalid mxc:// URI: ' + file.url);
  const resp = await fetch(httpUrl, {
    headers: { Authorization: 'Bearer ' + session.accessToken },
  });
  if (!resp.ok) throw new MatrixError(resp.status, undefined, resp.statusText);
  const ciphertext = await resp.arrayBuffer();
  try {
    const plaintext = await decryptAttachment(ciphertext, file);
    return new Response(plaintext, {
      headers: contentType ? { 'Content-Type': contentType } : undefined,
    });
  } catch (e) {
    throw new MatrixError(
      0,
      'M_DECRYPTION_FAILED',
      'Failed to decrypt attachment: ' + (e instanceof Error ? e.message : String(e)),
    );
  }
}
