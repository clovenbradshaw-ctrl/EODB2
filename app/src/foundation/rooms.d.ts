import type { MatrixEvent, Room } from 'matrix-js-sdk';

export interface AppRoom {
  roomId: string;
  name: string;
  roomType: string;
  membership: 'join' | 'invite' | 'leave';
  inviter: string | null;
  meta: Record<string, unknown>;
}

export function createRoom(
  name: string,
  roomType: string,
  meta?: Record<string, unknown>,
): Promise<string>;
export function discoverRooms(roomType?: string | null): AppRoom[];
export function acceptInvite(roomId: string): Promise<void>;
export function onRoomChanges(handler: () => void): () => void;
export function getTimeline(roomId: string): MatrixEvent[];
export function loadFullTimeline(roomId: string): Promise<number>;
export function onTimeline(
  roomId: string,
  handler: (event: MatrixEvent, room: Room) => void,
): () => void;
export function onDecrypted(
  roomId: string,
  handler: (event: MatrixEvent) => void,
): () => void;
export function loadTimelineSince(
  roomId: string,
  sinceTs: number,
): Promise<{ total: number; newEvents: MatrixEvent[] }>;
export function loadMore(roomId: string, limit?: number): Promise<boolean>;
export function invite(roomId: string, userId: string): Promise<void>;
export function getMembers(
  roomId: string,
): Array<{ userId: string; displayName: string; membership: string }>;
