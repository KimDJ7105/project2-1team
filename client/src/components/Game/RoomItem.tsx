// client/src/components/Game/RoomItem.tsx 

import React from 'react';
import type { Room } from '../../hooks/useSocket';

interface RoomItemProps {
  room: Room;
  onJoin: (roomId: string) => void;
}

export const RoomItem: React.FC<RoomItemProps> = ({ room, onJoin }) => {
  const isFull = room.playerCount === 2;
  const statusIcon = isFull ? '🔒' : '➕';

  const roomTag = room.roomId.split('_').pop() || '';

  return (
    <div
      className={`room-item ${isFull ? 'full' : ''}`}
      onClick={() => !isFull && onJoin(room.roomId)}
    >
      <span className="name">
        {statusIcon} {room.roomTitle}
        <span style={{ color: '#888', fontSize: '0.85em', marginLeft: '6px', fontWeight: 500 }}>
          #{roomTag}
        </span>
      </span>
      <span className="count">
        {room.playerCount} / 2
      </span>
    </div>
  );
};