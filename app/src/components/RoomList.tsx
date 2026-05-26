import { useState } from 'react';
import { createRoom, invite, getMembers, type AppRoom } from '../foundation/rooms.js';

interface Props {
  rooms: AppRoom[];
  selectedRoomId: string | null;
  onSelect: (roomId: string) => void;
  onAcceptInvite: (roomId: string) => void;
  onLog: (msg: string, level?: 'info' | 'error') => void;
}

export function RoomList({ rooms, selectedRoomId, onSelect, onAcceptInvite, onLog }: Props) {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('table');
  const [inviteMxid, setInviteMxid] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const roomId = await createRoom(newName.trim(), newType.trim() || 'table');
      onLog(`Created room ${newName}`);
      setNewName('');
      onSelect(roomId);
    } catch (e) {
      onLog(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const handleInvite = async () => {
    if (!selectedRoomId || !inviteMxid.trim()) return;
    try {
      await invite(selectedRoomId, inviteMxid.trim());
      onLog(`Invited ${inviteMxid} to ${selectedRoomId}`);
      setInviteMxid('');
    } catch (e) {
      onLog(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const selected = rooms.find((r) => r.roomId === selectedRoomId);
  const memberCount = selected ? getMembers(selected.roomId).length : 0;

  return (
    <div className="room-list">
      <section>
        <h3>Rooms</h3>
        {rooms.length === 0 && <div className="dim small">No rooms yet.</div>}
        {rooms.map((r) => (
          <div
            key={r.roomId}
            className={
              'room-item' +
              (r.roomId === selectedRoomId ? ' active' : '') +
              (r.membership === 'invite' ? ' invite' : '')
            }
            onClick={() => onSelect(r.roomId)}
          >
            <div className="room-name">{r.name || r.roomId}</div>
            <div className="room-meta">
              {r.membership === 'invite' ? (
                <button
                  className="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAcceptInvite(r.roomId);
                  }}
                >
                  Accept invite
                </button>
              ) : (
                <span className="tag">{r.roomType}</span>
              )}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h3>Create room</h3>
        <input
          placeholder="Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          placeholder="Type (e.g. table)"
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
        />
        <button onClick={handleCreate}>Create</button>
      </section>

      {selected && selected.membership === 'join' && (
        <section>
          <h3>Invite</h3>
          <div className="dim small">{memberCount} member(s) in this room</div>
          <input
            placeholder="@user:server"
            value={inviteMxid}
            onChange={(e) => setInviteMxid(e.target.value)}
          />
          <button onClick={handleInvite}>Invite</button>
        </section>
      )}
    </div>
  );
}
