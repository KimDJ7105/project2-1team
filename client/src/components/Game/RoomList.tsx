// client/src/components/Game/RoomList.tsx 

import React from 'react';
import type { Room } from '../../hooks/useSocket';
import { RoomItem } from './RoomItem';

interface RoomListProps {
  rooms: Room[];
  onJoinRoom: (roomId: string) => void;
}

export const RoomList: React.FC<RoomListProps> = ({ rooms, onJoinRoom }) => {
    console.log('현재 전달받은 방 목록:', rooms);

  if (!rooms || rooms.length === 0) {
    return (
      <div className="text-center muted" style={{ padding: '20px' }}>
        현재 개설된 게임방이 없습니다.
      </div>
    );
  }

  return (
    <div className="room-list" 
    style={{ 
        maxHeight: '320px', 
        overflowY: 'auto', 
        paddingRight: '4px' 
      }}
    >
      {rooms.map((room) => (
        <RoomItem key={room.roomId} room={room} onJoin={onJoinRoom} />
      ))}
    </div>
  );
};