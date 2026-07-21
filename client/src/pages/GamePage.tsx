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

interface PlayerInfo {
  email?: string;
  nickname: string;
  socketId?: string;
  color: 'black' | 'white';
  isReady?: boolean;
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
  const [opponent, setOpponent] = useState<PlayerInfo | null>(null);
  const [stones, setStones] = useState<Stone[]>([]);
  const [myAugments, setMyAugments] = useState<string[]>(['＋', '🌫️']);

  const parseBoardToStones = (board: any[][]): Stone[] => {
    if (!board || !Array.isArray(board)) return [];
    const newStones: Stone[] = [];
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const val = board[y]?.[x];
        if (val === 'black' || val === 'b') {
          newStones.push({ x, y, color: 'black' });
        } else if (val === 'white' || val === 'w') {
          newStones.push({ x, y, color: 'white' });
        }
      }
    }
    return newStones;
  };

  useEffect(() => {
    if (!socket) return;

    // 공통 상태 적용 함수 (game:start, game:sync:response, game:update에서 사용)
    const applyGameState = (data: any) => {
      console.log('[GamePage] 상태 데이터 반영:', data);

      const nextTurn = data.turn || data.currentTurn;
      if (nextTurn === 'black' || nextTurn === 'white' || nextTurn === 'b' || nextTurn === 'w') {
        setCurrentTurn(nextTurn === 'b' ? 'black' : nextTurn === 'w' ? 'white' : nextTurn);
      }

      if (data.turnCount !== undefined) setTurnCount(data.turnCount);

      if (data.board) {
        setStones(parseBoardToStones(data.board));
      } else if (data.x !== undefined && data.y !== undefined && data.color) {
        const colorVal = data.color === 'b' ? 'black' : data.color === 'w' ? 'white' : data.color;
        setStones((prev) => {
          if (prev.some((s) => s.x === data.x && s.y === data.y)) return prev;
          return [...prev, { x: data.x, y: data.y, color: colorVal as 'black' | 'white' }];
        });
      }

      if (data.players && Array.isArray(data.players)) {
        // 이메일, 닉네임, 소켓 ID 중 하나로 내 정보 식별
        const me = data.players.find((p: PlayerInfo) => 
          (user?.email && p.email === user.email) ||
          (user?.nickname && p.nickname === user.nickname) ||
          (p.socketId && p.socketId === socket.id)
        );
        const opp = data.players.find((p: PlayerInfo) => 
          (user?.email && p.email !== user.email) ||
          (user?.nickname && p.nickname !== user.nickname) ||
          (p.socketId && p.socketId !== socket.id)
        );
        
        if (me) {
          const colorVal = me.color === 'b' ? 'black' : me.color === 'w' ? 'white' : me.color;
          setMyColor(colorVal as 'black' | 'white');
        }
        if (opp) {
          const oppColorVal = opp.color === 'b' ? 'black' : opp.color === 'w' ? 'white' : opp.color;
          setOpponent({ ...opp, color: oppColorVal as 'black' | 'white' });
        }
      }
    };

    const handleGameError = (data: { message: string }) => {
      alert(`[오류] ${data.message}`);
    };

    const handleGameOver = (data: any) => {
      alert(data.message);
      onLeave();
    };

    socket.on('game:start', applyGameState);
    socket.on('game:sync:response', applyGameState);
    socket.on('game:update', applyGameState);
    socket.on('game:error', handleGameError);
    socket.on('game:over', handleGameOver);

    // 컴포넌트 마운트 즉시 게임 상태 동기화 요청 (이벤트 놓침 해결의 핵심)
    socket.emit('game:sync', { roomId });

    return () => {
      socket.off('game:start', applyGameState);
      socket.off('game:sync:response', applyGameState);
      socket.off('game:update', applyGameState);
      socket.off('game:error', handleGameError);
      socket.off('game:over', handleGameOver);
    };
  }, [socket, roomId, user, onLeave]);

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!socket) return;
    
    if (currentTurn !== myColor) {
      console.log(`[클릭 차단] 현재 턴(${currentTurn})과 내 색상(${myColor})이 다릅니다.`);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 7;
    const clickY = e.clientY - rect.top - 7;
    
    const x = Math.round((clickX - 14) / 22);
    const y = Math.round((clickY - 14) / 22);

    if (x < 0 || x > 14 || y < 0 || y > 14) return;

    if (stones.some((s) => s.x === x && s.y === y)) {
      return;
    }

    console.log(`[클라이언트 착수 요청] 좌표: (${x}, ${y}), 내 색상: ${myColor}`);
    socket.emit('game:put_stone', { roomId, x, y });
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
              <div style={{ fontSize: '13px', fontWeight: 700 }}>
                {opponent ? `${opponent.nickname} (${opponent.color === 'black' ? '흑' : '백'})` : '상대방'}
              </div>
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