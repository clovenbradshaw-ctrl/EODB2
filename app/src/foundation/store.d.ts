import type { FoldState } from './fold';

export class EventStore {
  constructor(roomId: string, namespace: string);
  open(): Promise<this>;
  append(matrixEvents: unknown[]): Promise<unknown[]>;
  getAll(): Promise<unknown[]>;
  getEventsSince(sinceTs: number): Promise<unknown[]>;
  saveCheckpoint(state: FoldState): Promise<void>;
  loadCheckpoint(): Promise<{
    cursor: number;
    count: number;
    savedAt: number;
    state: FoldState;
  } | null>;
  shouldCheckpoint(): boolean;
  getCursor(): number;
  getCount(): number;
  getByteSize(): number;
  hasData(): boolean;
  clear(): Promise<void>;
}

export function listStoredRooms(): Promise<string[]>;
export function getStorageUsage(): Promise<{ files: number; bytes: number }>;
