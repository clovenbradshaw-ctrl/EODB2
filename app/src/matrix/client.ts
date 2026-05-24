/**
 * MatrixClient singleton + lifecycle.
 *
 * One initialized `matrix-js-sdk` MatrixClient per session. The first call to
 * `getClient(session)` creates the client, initializes Rust crypto (Olm /
 * Megolm via @matrix-org/matrix-sdk-crypto-wasm), and starts the /sync loop.
 * Subsequent calls return the same instance.
 *
 * Crypto state is persisted in IndexedDB by the SDK. We do not pass a custom
 * pickle key — the IndexedDB store is per-origin and we already rely on the
 * browser's origin isolation for the access token in localStorage.
 */

import * as sdk from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import type { Session } from './rest';

let activeClient: MatrixClient | null = null;
let initPromise: Promise<MatrixClient> | null = null;

export async function getClient(session: Session): Promise<MatrixClient> {
  if (activeClient && activeClient.getAccessToken() === session.accessToken) {
    return activeClient;
  }
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const client = sdk.createClient({
      baseUrl: session.homeserver,
      userId: session.userId,
      deviceId: session.deviceId,
      accessToken: session.accessToken,
    });
    await client.initRustCrypto({ useIndexedDB: true });
    await client.startClient({ initialSyncLimit: 50 });
    activeClient = client;
    initPromise = null;
    return client;
  })();
  return initPromise;
}

export async function shutdownClient(): Promise<void> {
  if (!activeClient) return;
  const c = activeClient;
  activeClient = null;
  initPromise = null;
  c.stopClient();
  try { await c.clearStores(); } catch { /* ignore */ }
}
