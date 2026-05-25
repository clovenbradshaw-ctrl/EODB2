import type { MatrixClient } from 'matrix-js-sdk';

export type NetworkState = 'online' | 'degraded' | 'offline';

export function getNetworkState(): NetworkState;
export function onNetworkChange(fn: (state: NetworkState) => void): () => void;
export function watchSync(client: MatrixClient | null): () => void;
export function getSyncState(): string | null;
