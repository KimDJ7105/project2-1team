// client/src/components/Game/RoomItem.tsx 

import React from 'react';
import type { Room } from '../../hooks/useSocket';

interface RoomItemProps {
  room: Room;
  onJoin: (roomId: string) => void;
}

export const RoomItem: React.FC<RoomItemProps> = ({ room, onJoin }) => {
  const isFull = room.currentPlayers >= room.maxPlayers;
  const statusIcon = isFull ? '🔒' : room.isPrivate ? '🔑' : '➕';

  return (
    <div
      className={`room-item ${isFull ? 'full' : ''}`}
      onClick={() => !isFull && onJoin(room.roomId)}
    >
      <span className="name">
        {statusIcon} {room.title}
      </span>
      <span className="count">
        {room.currentPlayers} / {room.maxPlayers}
      </span>
    </div>
  );
};