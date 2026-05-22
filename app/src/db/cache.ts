/**
 * OPFS-backed event cache, encrypted at rest with AES-GCM.
 *
 * Why: cold-start hydration from Matrix is N events round-trips. After
 * the first session we have the events locally; reading them from OPFS
 * is ~instant. The store can show records immediately from cache, then
 * the live /sync subscription fills in anything new. /messages pagination
 * still runs in the background to catch any backfill the user missed
 * while offline.
 *
 * Why encryption: OPFS is per-origin and not synced, but it sits on the
 * user's disk in plaintext by default. For an immigration practice's
 * case data we want at-rest encryption. We derive an AES-GCM key from
 * the user's Matrix access token via PBKDF2 — so the cache only opens
 * for a session with the same token. On logout / token-rotation the
 * file becomes unreadable and we delete it on the next boot.
 *
 * Format: one file per user/room, opaque blob:
 *   [4-byte LE magic 'EODB']
 *   [4-byte LE version=1]
 *   [12-byte AES-GCM IV]
 *   [16-byte PBKDF2 salt]
 *   [encrypted payload: JSON-stringified EoEvent[]]
 */

import type { EoEvent } from './types';

const MAGIC = new Uint8Array([0x45, 0x4f, 0x44, 0x42]); // 'EODB'
const VERSION = 1;
const FILENAME_PREFIX = 'eodb2_cache_';
const PBKDF2_ITERATIONS = 100_000;

async function deriveKey(accessToken: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(accessToken),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Hash inputs to a stable per-user-per-room filename. */
async function cacheFilename(userId: string, roomId: string): Promise<string> {
  const enc = new TextEncoder();
  const h = await crypto.subtle.digest('SHA-256', enc.encode(userId + '|' + roomId));
  const hex = Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return FILENAME_PREFIX + hex.slice(0, 16);
}

async function opfsDir(): Promise<FileSystemDirectoryHandle | null> {
  // Older browsers (and many tests) don't have OPFS. Treat as no-cache.
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
  try { return await navigator.storage.getDirectory(); }
  catch { return null; }
}

export interface CacheKey {
  userId: string;
  roomId: string;
  accessToken: string;
}

/** Load and decrypt the cache for this user/room. Returns null on miss/error. */
export async function loadCache(key: CacheKey): Promise<EoEvent[] | null> {
  const dir = await opfsDir();
  if (!dir) return null;
  const name = await cacheFilename(key.userId, key.roomId);
  let bytes: Uint8Array;
  try {
    const handle = await dir.getFileHandle(name, { create: false });
    const file = await handle.getFile();
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return null; // missing file
  }
  if (bytes.length < 4 + 4 + 12 + 16) return null;
  // Header
  for (let i = 0; i < 4; i++) if (bytes[i] !== MAGIC[i]) return null;
  const version = new DataView(bytes.buffer, bytes.byteOffset + 4, 4).getUint32(0, true);
  if (version !== VERSION) return null;
  const iv = bytes.slice(8, 20);
  const salt = bytes.slice(20, 36);
  const ct = bytes.slice(36);
  try {
    const aesKey = await deriveKey(key.accessToken, salt);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
    const json = new TextDecoder().decode(pt);
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return parsed as EoEvent[];
  } catch {
    // Wrong key (e.g. token rotated) or corrupted file. Caller should
    // proceed without the cache; we'll rewrite a fresh one after hydrate.
    return null;
  }
}

/** Encrypt and write the cache. Caller debounces. */
export async function saveCache(key: CacheKey, events: EoEvent[]): Promise<void> {
  const dir = await opfsDir();
  if (!dir) return;
  const name = await cacheFilename(key.userId, key.roomId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const aesKey = await deriveKey(key.accessToken, salt);
  // Strip pending events — they have local-only event_ids and will be
  // re-dispatched by the user (or surfaced as failures). Cache only what
  // Matrix has acked.
  const acked = events.filter((e) => e.event_id && !e.event_id.startsWith('$pending:'));
  const pt = new TextEncoder().encode(JSON.stringify(acked));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, pt));
  const out = new Uint8Array(4 + 4 + 12 + 16 + ct.byteLength);
  out.set(MAGIC, 0);
  new DataView(out.buffer).setUint32(4, VERSION, true);
  out.set(iv, 8);
  out.set(salt, 20);
  out.set(ct, 36);
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(out as BufferSource);
  await writable.close();
}

/** Delete this user's cache. Called on logout. */
export async function clearCache(key: CacheKey): Promise<void> {
  const dir = await opfsDir();
  if (!dir) return;
  const name = await cacheFilename(key.userId, key.roomId);
  try { await dir.removeEntry(name); } catch { /* missing is fine */ }
}
