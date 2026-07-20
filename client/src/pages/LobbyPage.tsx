//client/src/pages/LobbyPage.tsx
import React,{ useState, useCallback, useEffect } from 'react';
import '../assets/styles/LobbyStyles.css';
import { useSocket } from '../hooks/useSocket';
import { RoomList } from '../components/Game/RoomList';
import { BottomNav } from '../components/Game/BottomNav';
import type { Socket } from 'socket.io-client';
import type { Room } from '../hooks/useSocket';


interface LobbyPageProps {
  socket: Socket | null; // App.tsx에서 넘겨주는 소켓
  user: { nickname: string; email: string }; // user 객체 통째로 받기
  onLogout: () => void;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({ socket, user, onLogout }) => {
  const [rooms, setRooms] = useState<Room[]>([]);

  // 소켓 공유: 훅을 쓰지 않고 직접 socket 객체 사용
  const requestRoomList = useCallback(() => {
    if (socket?.connected) socket.emit('room:list');
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    
    socket.on('room:list', (list: Room[]) => setRooms(list));
    requestRoomList();
    
    return () => { socket.off('room:list'); };
  }, [socket, requestRoomList]);

  const handleCreateRoom = () => {
    const title = prompt('생성할 방 제목을 입력하세요:', `${user.nickname}의 방`);
    if (title && socket) socket.emit('room:create', { title });
  };

  const handleJoinRoom = (roomId: string) => {
    if (socket) socket.emit('room:join', { roomId });
  };

  return (
    <div className="phone">
      <div className="pad flex-col flex-1" style={{ gap: '6px' }}>
        <div className="row between">
          <div className="row">
            <div className="avatar">🦁</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>
                {userNickname}님
              </div>
              <span className="badge">🏆 1,210</span>
            </div>
          </div>
          <div className="row" style={{ gap: '14px' }}>
            <span style={{ fontSize: '20px', cursor: 'pointer' }}>🔔</span>
            <span
              onClick={onLogout}
              style={{
                fontSize: '14px',
                color: 'var(--text-sub)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              로그아웃
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'center', margin: '22px 0 8px' }}>
          <p className="title-sm" style={{ fontSize: '40px', margin: 0 }}>
            증강오목
          </p>
          <p
            className="muted"
            style={{ fontSize: '11px', letterSpacing: '.08em', margin: '2px 0 0' }}
          >
            AUGMENTED OMOK
          </p>
        </div>

        <button className="btn" onClick={handleCreateRoom}>
          ＋ 방 만들기
        </button>

        <div className="row between" style={{ margin: '24px 0 10px' }}>
          <p className="section-label" style={{ margin: 0 }}>
            게임방 목록
          </p>
          <span
            onClick={requestRoomList}
            style={{
              fontSize: '13px',
              cursor: 'pointer',
              color: 'var(--teal-dark)',
              fontWeight: 700,
            }}
          >
            🔄 새로고침
          </span>
        </div>

        <RoomList rooms={rooms} onJoinRoom={handleJoinRoom} />
      </div>

      <BottomNav />
    </div>
  );
};