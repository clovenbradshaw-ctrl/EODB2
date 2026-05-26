import type { MatrixClient } from 'matrix-js-sdk';

export function setProgress(fn: (msg: string) => void): void;
export function setRecoveryKeyProvider(fn: () => Promise<string | null>): void;
export function setRecoveryKeyDisplayer(fn: (key: string) => Promise<void>): void;
export function getClient(): MatrixClient | null;

export function login(
  homeserver: string,
  username: string,
  password: string,
): Promise<{ client: MatrixClient; userId: string; deviceId: string }>;

export function restoreSession(userId: string): Promise<MatrixClient | null>;

export function unlock(
  userId: string,
  password: string,
): Promise<{ userId: string; online: boolean }>;

export function lock(): Promise<void>;

export function logout(): Promise<void>;

export function hasLocalAccount(userId: string): boolean;
