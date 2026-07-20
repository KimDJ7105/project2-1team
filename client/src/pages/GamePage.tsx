// client/src/pages/GamePage.tsx
// 일단 임시 페이지. 
import React from 'react';
import type { Socket } from 'socket.io-client';

interface GamePageProps {
  socket: Socket | null;
  roomId: string;
  roomTitle: string;
  user: { nickname: string; email: string };
  onLeave: () => void;
}

export const GamePage: React.FC<GamePageProps> = ({
  socket,
  roomId,
  roomTitle,
  user,
  onLeave,
}) => {
  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('room:leave', { roomId });
    }
    onLeave();
  };

  return (
    <div className="phone">
      <div className="pad flex-col flex-1" style={{ gap: '20px', padding: '20px' }}>
        <div className="row between">
          <span style={{ fontSize: '18px', fontWeight: 800 }}>방: {roomTitle}</span>
          <button 
            onClick={handleLeaveRoom}
            style={{ padding: '8px 12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
          >
            방 나가기
          </button>
        </div>

        <div style={{ backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 700, color: '#333' }}>[방 정보 디버그]</p>
          <p style={{ margin: '4px 0', fontSize: '14px' }}>방 ID: {roomId}</p>
          <p style={{ margin: '4px 0', fontSize: '14px' }}>내 닉네임: {user.nickname}</p>
          <p style={{ margin: '4px 0', fontSize: '14px', color: 'blue', fontWeight: 600 }}>
            현재 상태: 대기 중 (waiting)
          </p>
        </div>

        <div 
          className="flex-1 flex-col center" 
          style={{ border: '2px dashed #ccc', borderRadius: '12px', minHeight: '300px', justifyContent: 'center', alignItems: 'center', display: 'flex' }}
        >
          <p style={{ fontSize: '18px', fontWeight: 700, color: '#666' }}>
            게임판(바둑판) 및 준비/시작 로직 렌더링 영역
          </p>
        </div>
      </div>
    </div>
  );
};