// client/src/pages/WaitingRoomPage.tsx
import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import '../assets/styles/WaitingRoomStyles.css';

interface Player {
  socketId: string;
  email?: string;
  nickname: string;
  isReady: boolean;
  avatar?: string;
}

interface WaitingRoomPageProps {
  socket: Socket | null;
  roomId: string;
  roomTitle: string;
  user: any;
  initialPlayers?: Player[];
  onLeave: () => void;
  onStartGame: () => void;
}

export const WaitingRoomPage: React.FC<WaitingRoomPageProps> = ({
  socket,
  roomId,
  roomTitle,
  user,
  initialPlayers = [],
  onLeave,
  onStartGame,
}) => {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleRoomUpdate = (data: { players: Player[] }) => {
      if (data && data.players) {
        setPlayers(data.players);
        const myInfo = data.players.find((p) => p.nickname === user.nickname || p.socketId === socket.id);
        if (myInfo) {
          setIsReady(myInfo.isReady);
        }
      }
    };

    const handleGameStart = () => {
      console.log('[게임 시작 이벤트 수신] 본 게임 화면으로 이동합니다.');
      onStartGame();
    };

    socket.on('room:update', handleRoomUpdate);
    socket.on('game:start', handleGameStart);

    return () => {
      socket.off('room:update', handleRoomUpdate);
      socket.off('game:start', handleGameStart);
    };
  }, [socket, user]);

  const handleReadyClick = () => {
    if (!socket) return;
    const nextState = !isReady;
    setIsReady(nextState);
    socket.emit('room:ready', { roomId, isReady: nextState });
  };

  const handleLeaveClick = () => {
    if (socket) {
      socket.emit('room:leave', { roomId });
    }
    onLeave();
  };

  const firstPlayer = players[0];
  const secondPlayer = players[1];
  const totalPlayers = players.length;

  return (
    <div className="phone">
      <div className="pad waiting-room-container">
        {/* 상단 */}
        <div className="waiting-header">
          <button className="back-btn" onClick={handleLeaveClick}>←</button>
          <span style={{ fontWeight: 700 }}>방 이름 : {roomTitle || '오목 방'}</span>
        </div>

        {/* 플레이어 목록 */}
        <div className="players-row">
          {/* 첫 번째 플레이어 (방장) */}
          <div className="player-card">
            <div className="avatar lg">{firstPlayer?.avatar || '🦁'}</div>
            <div className="player-name">{firstPlayer?.nickname || user?.nickname || '입장 중...'}</div>
            {firstPlayer?.isReady && <div className="badge">준비완료!</div>}
          </div>

          {/* 두 번째 플레이어 (참가자) */}
          <div className="player-card">
            {secondPlayer ? (
              <>
                <div className="avatar lg">{secondPlayer.avatar || '🐯'}</div>
                <div className="player-name">{secondPlayer.nickname}</div>
                {secondPlayer.isReady && <div className="badge">준비완료!</div>}
              </>
            ) : (
              <>
                <div className="avatar lg empty">❔</div>
                <div className="muted" style={{ fontSize: '14px', fontWeight: 700 }}>대기중...</div>
              </>
            )}
          </div>
        </div>

        {/* 인원 */}
        <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '16px' }}>
          인원 {totalPlayers || 1} / 2
        </p>

        {/* 상태 메시지 */}
        <div className="status-message">
          {totalPlayers < 2
            ? '🍂 상대방을 기다리고 있어요'
            : '🔥 모든 플레이어가 모였습니다! 준비해주세요.'}
        </div>

        <div style={{ flex: 1 }}></div>

        {/* 준비 버튼 */}
        <button
          className={`btn ready-btn ${isReady ? 'is-ready' : ''}`}
          onClick={handleReadyClick}
          disabled={totalPlayers < 2}
          style={{ opacity: totalPlayers < 2 ? 0.6 : 1 }}
        >
          {totalPlayers < 2
            ? '상대방 대기 중...'
            : isReady
            ? '준비 취소'
            : '준비 완료 →'}
        </button>
      </div>
    </div>
  );
};