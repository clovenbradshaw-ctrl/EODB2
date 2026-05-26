export interface VaultChangeEvent {
  unlocked: boolean;
  userId: string | null;
}

export interface VaultInstance {
  isUnlocked(): boolean;
  getUserId(): string | null;
  hasMeta(userId: string): boolean;
  onChange(fn: (event: VaultChangeEvent) => void): () => void;
  initialize(userId: string, password: string): Promise<void>;
  unlock(userId: string, password: string): Promise<boolean>;
  rekey(userId: string, newPassword: string): Promise<void>;
  lock(): void;
  wipe(userId: string): void;
  encryptBytes(plaintext: Uint8Array): Promise<Uint8Array>;
  decryptBytes(blob: Uint8Array): Promise<Uint8Array>;
  encryptJSON(obj: unknown): Promise<Uint8Array>;
  decryptJSON(blob: Uint8Array): Promise<unknown>;
  encryptString(str: string): Promise<Uint8Array>;
  decryptString(blob: Uint8Array): Promise<string>;
}

export const vault: VaultInstance;

export function encryptToB64(plaintextStr: string): Promise<string>;
export function decryptFromB64(b64Str: string): Promise<string>;
export function sessionKey(userId: string): string;
export function listVaultUsers(): string[];
export function rememberLastUser(userId: string): void;
export function getLastUser(): string | null;
export function forgetLastUser(): void;
