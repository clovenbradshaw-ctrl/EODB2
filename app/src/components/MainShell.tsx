import { useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { discoverRooms, onRoomChanges, acceptInvite, type AppRoom } from '../foundation/rooms.js';
import { RoomList } from './RoomList';
import { TableView } from './TableView';

interface Props {
  userId: string;
  client: MatrixClient | null;
  onLog: (msg: string, level?: 'info' | 'error') => void;
}

export function MainShell({ userId, client, onLog }: Props) {
  const [rooms, setRooms] = useState<AppRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Refresh the room list on any change: new room, membership flip, state
  // event arrival. discoverRooms() reads directly off the SDK's room map.
  useEffect(() => {
    if (!client) return;
    const refresh = () => setRooms(discoverRooms());
    refresh();
    return onRoomChanges(refresh);
  }, [client]);

  // Keep the selection valid as the room list shifts under us.
  useEffect(() => {
    if (selectedRoomId && !rooms.some((r) => r.roomId === selectedRoomId)) {
      setSelectedRoomId(null);
    }
  }, [rooms, selectedRoomId]);

  const handleAccept = async (roomId: string) => {
    try {
      await acceptInvite(roomId);
      onLog(`Joined ${roomId}`);
    } catch (e) {
      onLog(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const selected = rooms.find((r) => r.roomId === selectedRoomId) ?? null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <RoomList
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          onSelect={setSelectedRoomId}
          onAcceptInvite={handleAccept}
          onLog={onLog}
        />
      </aside>
      <main className="content">
        {selected && selected.membership === 'join' ? (
          <TableView room={selected} userId={userId} onLog={onLog} />
        ) : (
          <div className="empty">
            {rooms.length === 0
              ? 'No rooms yet — create one in the sidebar.'
              : 'Select a room.'}
          </div>
        )}
      </main>
    </div>
  );
}
