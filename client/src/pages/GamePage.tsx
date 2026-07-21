import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import '../assets/styles/GameStyles.css';

interface GamePageProps {
  socket: Socket | null;
  roomId: string;
  roomTitle: string;
  user: any;
  onLeave: () => void;
}

interface Stone {
  x: number;
  y: number;
  color: 'black' | 'white';
  isAugmented?: boolean;
}

export const GamePage: React.FC<GamePageProps> = ({
  socket,
  roomId,
  roomTitle,
  user,
  onLeave,
}) => {
  const [turnCount, setTurnCount] = useState<number>(1);
  const [currentTurn, setCurrentTurn] = useState<'black' | 'white'>('black');
  const [myColor, setMyColor] = useState<'black' | 'white'>('black');
  const [stones, setStones] = useState<Stone[]>([
    { x: 7, y: 7, color: 'black' },
    { x: 8, y: 7, color: 'white', isAugmented: true },
  ]);

  const [myAugments, setMyAugments] = useState<string[]>(['➕', '🌫️']);

  useEffect(() => {
    if (!socket) return;

    const handleGameUpdate = (data: any) => {
      console.log('[GamePage] 서버 게임 상태 수신:', data);
    };

    const handleGameOver = (data: any) => {
      alert(data.message);
      onLeave();
    };

    socket.on('game:update', handleGameUpdate);
    socket.on('game:over', handleGameOver);

    return () => {
      socket.off('game:update', handleGameUpdate);
      socket.off('game:over', handleGameOver);
    };
  }, [socket, onLeave]);

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!socket) return;
    
    if (currentTurn !== myColor) {
      console.log('내 턴이 아닙니다.');
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 7;
    const clickY = e.clientY - rect.top - 7;
    
    const x = Math.round((clickX - 14) / 22);
    const y = Math.round((clickY - 14) / 22);

    if (x < 0 || x > 14 || y < 0 || y > 14) return;

    console.log(`[클라이언트 착수 시도] 좌표: (${x}, ${y})`);

    setStones((prev) => [...prev, { x, y, color: myColor }]);
    setCurrentTurn(currentTurn === 'black' ? 'white' : 'black');
    setTurnCount((prev) => prev + 1);
  };

  const handleSurrender = () => {
    if (window.confirm('정말 항복하시겠습니까?')) {
      if (socket) {
        socket.emit('game:surrender', { roomId });
      }
      onLeave();
    }
  };

  const nextAugmentTurn = turnCount <= 15 ? 15 : 30;
  const progressPercent = Math.min(100, ((turnCount % 15) / 15) * 100);

  const getStarPos = (gridPos: number) => `${14 + gridPos * 22}px`;

  return (
    <div className="game-phone-container">
      <div className="game-pad">
        <div className="game-row game-between">
          <div className="game-row">
            <div className="game-avatar">🦁</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>
                {user?.nickname || '나'} ({myColor === 'black' ? '흑' : '백'})
              </div>
              {currentTurn === myColor && <div className="game-badge">내 차례</div>}
            </div>
          </div>
          <span className="game-timer">⏱ 00:45</span>
          <div className="game-row">
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>상대방</div>
              {currentTurn !== myColor ? (
                <div className="game-badge" style={{ background: '#f0dfc0' }}>상대 차례</div>
              ) : (
                <div className="game-muted" style={{ fontSize: '10px' }}>대기중</div>
              )}
            </div>
            <div className="game-avatar">☁️</div>
          </div>
        </div>

        <div className="gauge-wrap">
          <div className="gauge-label">
            <span>📍 다음 증강 선택까지</span>
            <span><strong style={{ color: 'var(--teal-dark)' }}>{turnCount}</strong> / {nextAugmentTurn}턴</span>
          </div>
          <div className="gauge-track">
            <div className="gauge-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>

        <div className="board" onClick={handleBoardClick}>
          <div className="grid-lines"></div>
          
          <div className="star-point" style={{ top: getStarPos(7), left: getStarPos(7) }}></div>
          <div className="star-point" style={{ top: getStarPos(3), left: getStarPos(3) }}></div>
          <div className="star-point" style={{ top: getStarPos(3), left: getStarPos(11) }}></div>
          <div className="star-point" style={{ top: getStarPos(11), left: getStarPos(3) }}></div>
          <div className="star-point" style={{ top: getStarPos(11), left: getStarPos(11) }}></div>

          {stones.map((stone, idx) => {
            const pixelX = 14 + stone.x * 22;
            const pixelY = 14 + stone.y * 22;
            return (
              <div
                key={idx}
                className={`stone ${stone.color === 'black' ? 'b' : 'w'} ${stone.isAugmented ? 'aug' : ''}`}
                style={{ top: `${pixelY}px`, left: `${pixelX}px` }}
              ></div>
            );
          })}
        </div>

        <div className="inv-section">
          <p className="inv-label">🃏 내 증강 (내 턴에 클릭해서 사용)</p>
          <div className="inv-row">
            {[0, 1, 2].map((idx) => {
              const aug = myAugments[idx];
              return (
                <div key={idx} className={`inv-slot my ${aug ? 'filled' : ''}`}>
                  {aug ? aug : '＋'}
                </div>
              );
            })}
          </div>
        </div>

        <div className="action-row">
          <button className="game-btn danger" onClick={handleSurrender}>
            항복
          </button>
        </div>
      </div>
    </div>
  );
};