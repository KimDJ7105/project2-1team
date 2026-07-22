//client/src/pages/GamePage.tsx
import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import '../assets/styles/GameStyles.css';
import { AugmentSelectModal, type AugmentOption } from '../components/Game/AugmentSelectModal';

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
  augments?: any[];
}

const augmentIconMap: Record<string, string> = {
  sniper: '🎯', seal_empty: '🚫', coin_flip: '🪙', double_coin: '🔀',
  chaos_party: '🌈', hidden_move: '🥷', fog_of_war: '🌫️', mixer: '🌪️',
  meteor: '☄️', different_game: '🧩', peek: '👁️', confiscate: '🔒',
  steal: '🦹', bombardment: '💣', table_flip: '┻━┻', undo: '⏪'
};

export const GamePage: React.FC<GamePageProps> = ({
  socket,
  roomId,
  user,
  onLeave,
}) => {
  const [turnCount, setTurnCount] = useState<number>(1);
  const [currentTurn, setCurrentTurn] = useState<'black' | 'white'>('black');
  const [myColor, setMyColor] = useState<'black' | 'white'>('black');
  const [opponent, setOpponent] = useState<PlayerInfo | null>(null);
  const [stones, setStones] = useState<Stone[]>([]);
  const [myAugments, setMyAugments] = useState<any[]>([]);
  const [isOverlayHidden, setIsOverlayHidden] = useState<boolean>(false);
  const [gameOverData, setGameOverData] = useState<{
    isOver: boolean;
    winnerColor?: 'black' | 'white';
    winnerNickname?: string;
    isMeWinner?: boolean;
  } | null>(null);
  const [isAugmentSelecting, setIsAugmentSelecting] = useState<boolean>(false);
  const [augmentOptions, setAugmentOptions] = useState<AugmentOption[]>([]);
  const [selectedAugmentToUse, setSelectedAugmentToUse] = useState<any | null>(null);
  const [augmentTargetMode, setAugmentTargetMode] = useState<any | null>(null);
  const [sealedCells, setSealedCells] = useState<{ x: number; y: number; turnsRemaining: number }[]>([]);

  // 서버의 2차원 보드 데이터를 돌 객체 배열로 변환
  const parseBoardToStones = (board: any[][]): Stone[] => {
    if (!board || !Array.isArray(board)) {
      console.warn('[오류] board 데이터가 배열이 아닙니다:', board);
      return [];
    }

    const newStones: Stone[] = [];
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const val = board[y]?.[x];
        // 빈칸이 아니며 유효한 값이 존재할 경우 전부 돌로 인식하여 강제 렌더링
        if (val && val !== '') {
          const colorStr = String(val).toLowerCase();
          const color: 'black' | 'white' = 
            colorStr.includes('w') || colorStr.includes('white') ? 'white' : 'black';
          
          newStones.push({ x, y, color });
        }
      }
    }
    //console.log('[디버깅] 파싱된 돌 목록:', newStones);
    return newStones;
  };

  useEffect(() => {
    if (!socket) return;

    // 플레이어 색상 및 정보 동기화를 담당하는 함수 (불변 값인 email과 nickname을 1, 2순위로 탐색)
    const syncPlayersInfo = (players: PlayerInfo[]) => {
      if (!players || !Array.isArray(players)) return;

      const me = players.find((p: PlayerInfo) => 
        (user?.email && p.email === user.email) ||
        (user?.nickname && p.nickname === user.nickname) ||
        (p.socketId && p.socketId === socket.id)
      );
      const opp = players.find((p: PlayerInfo) => 
        (user?.email && p.email !== user.email) ||
        (user?.nickname && p.nickname !== user.nickname) ||
        (p.socketId && p.socketId !== socket.id)
      );
      
      if (me && me.color) {
        setMyColor(me.color);
        if (me.augments) {
          setMyAugments(me.augments);
        }
      }
      if (opp && opp.color) {
        setOpponent(opp);
      }
    };

    // 초기 상태 및 동기화 응답 처리용 함수
    const handleInitialState = (data: any) => {
      console.log('[GamePage] 초기/동기화 데이터 수신:', data);

      const nextTurn = data.turn || data.currentTurn;
      if (nextTurn) {
        setCurrentTurn(nextTurn === 'b' ? 'black' : nextTurn === 'w' ? 'white' : nextTurn);
      }
      if (data.turnCount !== undefined) setTurnCount(data.turnCount);
      if (data.board) {
        setStones(parseBoardToStones(data.board));
      }

      if (data.sealedCells) {
        setSealedCells(data.sealedCells);
      }

      if (data.players && Array.isArray(data.players)) {
        syncPlayersInfo(data.players);
      }
    };

    // 착수 성공 시 서버가 보내는 갱신 신호 처리
    const handleGameUpdate = (data: any) => {
      console.log('[GamePage] 게임 업데이트 수신:', data);

      // 서버로부터 턴 진행(동기화) 신호가 오면 모든 증강 대기가 끝났다고 판단하여 모달을 닫음
      setIsAugmentSelecting(false);

      if (data.currentTurn) {
        const nextTurn = data.currentTurn === 'b' ? 'black' : data.currentTurn === 'w' ? 'white' : data.currentTurn;
        setCurrentTurn(nextTurn);
      }
      if (data.turnCount !== undefined) setTurnCount(data.turnCount);

      if (data.sealedCells !== undefined) {
        setSealedCells(data.sealedCells);
      }

      // 게임 도중에도 플레이어 정보가 실려올 경우 색상 상태를 다시 보장
      if (data.players && Array.isArray(data.players)) {
        syncPlayersInfo(data.players);
      }

      // 서버가 전체 board를 보냈다면 우선적으로 전체 보드 반영
      if (data.board && Array.isArray(data.board)) {
        setStones(parseBoardToStones(data.board));
      } 
      // 만약 개별 좌표로 들어왔다면 기존 stones 배열에 추가
      else if (data.x !== undefined && data.y !== undefined && data.color) {
        const colorVal = data.color === 'b' ? 'black' : data.color === 'w' ? 'white' : data.color;
        setStones((prev) => {
          if (prev.some((s) => s.x === data.x && s.y === data.y)) return prev;
          return [...prev, { x: data.x, y: data.y, color: colorVal as 'black' | 'white' }];
        });
      }
    };

    // 서버에서 증강 선택하라고 신호를 보낼 때
    const handleAugmentSelectRequest = (data: { options: AugmentOption[] }) => {
      console.log('[GamePage] 증강 선택 요청 수신:', data.options);
      if (data && Array.isArray(data.options)) {
        const formattedOptions = data.options.map(opt => ({
          ...opt,
          icon: augmentIconMap[opt.id] || '❓',
          rarity: opt.rarity as 'COMMON' | 'RARE' | 'EPIC' | 'LEGEND'
        }));
        setAugmentOptions(formattedOptions);
        setIsAugmentSelecting(true);
      }
    };

    const handleGameError = (data: { message: string }) => {
      alert(`[오류] ${data.message}`);
    };

    const handleGameOver = (data: any) => {
      console.log('[GamePage] 게임 종료 수신:', data);
      
      // 서버가 보낸 승자 색상과 내 색상(myColor)을 비교해 승패 정확히 판별
      const isWinner = data.winner === myColor;

      setGameOverData({
        isOver: true,
        winnerColor: data.winner,
        winnerNickname: data.winnerNickname || '알 수 없음',
        isMeWinner: isWinner,
      });

      setIsOverlayHidden(false);
    };

    socket.on('game:start', handleInitialState);
    socket.on('game:sync:response', handleInitialState);
    socket.on('game:update', handleGameUpdate); // 분리된 핸들러 연결
    socket.on('game:error', handleGameError);
    socket.on('game:over', handleGameOver);
    socket.on('game:augment:select', handleAugmentSelectRequest);

    // 진입 즉시 동기화 요청
    socket.emit('game:sync', { roomId });

    return () => {
      socket.off('game:start', handleInitialState);
      socket.off('game:sync:response', handleInitialState);
      socket.off('game:update', handleGameUpdate);
      socket.off('game:error', handleGameError);
      socket.off('game:over', handleGameOver);
      socket.off('game:augment:select', handleAugmentSelectRequest);
    };
  }, [socket, roomId, user, onLeave, myColor]);

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

    // 대상 선택형 증강을 사용하기 위해 보드를 클릭한 경우
    if (augmentTargetMode) {
      console.log(`[클라이언트 증강 대상 선택] 증강: ${augmentTargetMode.id}, 좌표: (${x}, ${y})`);
      socket.emit('game:augment:use', { 
        roomId, 
        augmentId: augmentTargetMode.id, 
        target: { x, y } 
      });
      setAugmentTargetMode(null);
      return;
    }

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
    }
  };

  const handleLeaveToMain = () => {
      if (socket && roomId) {
        socket.emit('room:leave', { roomId }); // 서버로 퇴장 신호 전송
      }
      onLeave(); // 기존 로비 이동 함수 실행
  };

  // 사용자가 모달에서 증강 선택을 완료했을 때 실행되는 함수
  const handleAugmentSelected = (selectedId: string) => {
    if (!socket) return;
    console.log('[GamePage] 증강 선택 완료, 서버로 전송:', selectedId);
    
    socket.emit('game:augment:choose', { roomId, augmentId: selectedId });
  };

  // 인벤토리 내 증강 클릭 시 실행되는 함수
  const handleAugmentClick = (aug: any) => {
    if (!aug) return;

    // 이미 사용된 증강인 경우 클릭 차단
    if (aug.isUsed) {
      alert('이미 사용한 증강입니다.');
      return;
    }

    if (currentTurn !== myColor) {
      alert('자신의 턴에만 증강을 사용할 수 있습니다.');
      return;
    }

    setSelectedAugmentToUse(aug);
  };

  // 모달창에서 사용하기 버튼 클릭 시 실행되는 함수
  const handleConfirmUseAugment = () => {
    if (!socket || !selectedAugmentToUse) return;

  // 즉시 발동이 아닌 대상 선택이 필요한 증강인 경우
  if (selectedAugmentToUse.type === 'TARGET_SELECT') {
    setAugmentTargetMode(selectedAugmentToUse);
    setSelectedAugmentToUse(null);
    alert('효과를 적용할 보드 위의 위치(돌 또는 빈칸)를 클릭해주세요.');
    return;
  }

  // 바로 서버로 전송하는 증강
  socket.emit('game:augment:use', { roomId, augmentId: selectedAugmentToUse.id });
  setSelectedAugmentToUse(null);
  };

  const nextAugmentTurn = turnCount <= 15 ? 15 : 30;
  // 30턴을 초과할 경우 게이지가 100%로 고정되도록 제한
  const progressPercent = turnCount >= 30 ? 100 : Math.min(100, ((turnCount % 15) / 15) * 100);

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
            <span><strong style={{ color: 'var(--teal-dark)' }}>{Math.min(turnCount, 30)}</strong> / {nextAugmentTurn}턴</span>
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
          
          {/* 봉인된 칸 표시 렌더링 */}
          {sealedCells.map((cell, idx) => {
            const pixelX = 2 + 14 + cell.x * 22;
            const pixelY = 2 + 14 + cell.y * 22;
            
            return (
              <div
                key={`seal-${idx}`}
                style={{
                  position: 'absolute',
                  top: `${pixelY}px`,
                  left: `${pixelX}px`,
                  width: '20px',
                  height: '20px',
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  zIndex: 5,
                  pointerEvents: 'none', // 아이콘이 클릭 이벤트를 막지 않도록 설정
                  opacity: 0.8
                }}
              >
                🚫
              </div>
            );
          })}

          {stones.map((stone, idx) => {
            // border(7px)와 grid-lines의 오프셋(14px)을 더해 주어야 격자 교차점과 정확히 일치함
            const pixelX = 2 + 14 + stone.x * 22;
            const pixelY = 2 + 14 + stone.y * 22;
            // 공백 방지 
            const stoneClass = `stone ${stone.color === 'black' ? 'b' : 'w'}${stone.isAugmented ? ' aug' : ''}`;
            return (
              <div
                key={idx}
                className={stoneClass}
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
              const displayIcon = aug ? (aug.icon || augmentIconMap[aug.id] || '❓') : null;
              
              return (
                <div 
                  key={idx} 
                  className={`inv-slot my ${aug ? 'filled' : ''} ${aug?.isUsed ? 'used' : ''}`}
                  style={aug?.isUsed ? { opacity: 0.4, filter: 'grayscale(100%)', cursor: 'not-allowed' } : {}}
                  onClick={() => handleAugmentClick(aug)}
                >
                  {displayIcon ? displayIcon : '＋'}
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
      {/* 보드판 보기를 눌렀을 때 화면 최상단에 뜨는 '결과 다시 보기' 플로팅 버튼 */}
      {gameOverData?.isOver && isOverlayHidden && (
        <button
          onClick={() => setIsOverlayHidden(false)}
          style={{
            position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 90, background: 'var(--teal)', color: '#0e3833', border: 'none',
            padding: '8px 16px', borderRadius: '20px', fontFamily: 'Jua, sans-serif',
            boxShadow: '0 4px 10px rgba(0,0,0,0.15)', cursor: 'pointer'
          }}
        >
          🏆 결과 다시 보기
        </button>
      )}
      {/* 게임 종료 결과 오버레이 */}
      {gameOverData?.isOver && !isOverlayHidden && (
        <div className="result-overlay">
          <span className="confetti" style={{ top: '40px', left: '36px' }}>🎊</span>
          <span className="confetti" style={{ top: '60px', right: '44px', animationDelay: '.6s' }}>⚫</span>
          <span className="confetti" style={{ top: '100px', left: '60px', animationDelay: '1.2s' }}>⚪</span>
          <span className="confetti" style={{ top: '80px', right: '80px', animationDelay: '1.8s' }}>🎊</span>

          <p className="result-title" style={{ color: gameOverData.isMeWinner ? 'var(--teal-dark)' : 'var(--danger, #e0654f)' }}>
            {gameOverData.isMeWinner ? '🎉 승리!' : '😢 패배'}
          </p>
          <p className="result-sub">
            {gameOverData.isMeWinner ? '멋진 한 수였습니다!' : '다음 기회에 도전해보세요!'}
          </p>

          <div className="vs-row">
            <div className={`side ${gameOverData.isMeWinner ? 'winner' : ''}`}>
              <div className="avatar">🦁</div>
              <div className="name">{user?.nickname || '나'} ({myColor === 'black' ? '흑' : '백'})</div>
            </div>
            <span className="vs-label">VS</span>
            <div className={`side ${!gameOverData.isMeWinner ? 'winner' : ''}`}>
              <div className="avatar">☁️</div>
              <div className="name">
                {opponent ? `${opponent.nickname} (${opponent.color === 'black' ? '흑' : '백'})` : '상대방'}
              </div>
            </div>
          </div>

          <div className="list-item">
            <span className="game-muted">총 턴 수</span>
            <b>{turnCount}턴</b>
          </div>
          <div className="list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '6px' }}>
            <span className="game-muted">사용한 증강</span>
            <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: '1.6', color: 'var(--text-main)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {myAugments && myAugments.length > 0 ? (
                myAugments.map((aug, idx) => {
                  const icon = typeof aug === 'object' ? (aug.icon || augmentIconMap[aug.id] || '🃏') : (augmentIconMap[aug] || '🃏');
                  const name = typeof aug === 'object' ? aug.name : aug;
                  return (
                    <span key={idx} style={{ background: '#f0dfc0', padding: '2px 8px', borderRadius: '6px' }}>
                      {icon} {name}
                    </span>
                  );
                })
              ) : (
                '선택한 증강 없음 (기본 모드)'
              )}
            </div>
          </div>

          <div style={{ flex: 1 }}></div>

          <div className="action-row" style={{ paddingBottom: '18px', gap: '8px', display: 'flex' }}>
            <button
              className="game-btn ghost"
              style={{ flex: 1, background: '#fffefb', border: '1.5px solid var(--card-border)', color: 'var(--text-main)' }}
              // null로 지우지 않고 가리기만 함
              onClick={() => setIsOverlayHidden(true)} 
            >
              보드판 보기
            </button>
            <button
              className="game-btn"
              style={{ flex: 1, background: 'var(--teal)', color: '#0e3833', boxShadow: '0 4px 0 var(--teal-dark)', border: 'none' }}
              onClick={handleLeaveToMain}
            >
              메인으로
            </button>
          </div>
        </div>
      )}
      {/* 증강 선택 모달 오버레이 렌더링 */}
      {isAugmentSelecting && (
        <AugmentSelectModal
          options={augmentOptions}
          onSelectComplete={handleAugmentSelected}
        />
      )}

      {/* 증강 사용 확인 모달 렌더링 영역 */}
      {selectedAugmentToUse && (
        <div className="aug-modal-overlay" onClick={() => setSelectedAugmentToUse(null)}>
          <div className="aug-modal-container" onClick={(e) => e.stopPropagation()}>
            <p className="aug-modal-title">증강 사용</p>

            <div className="aug-card-item selected" style={{ cursor: 'default', marginBottom: '16px' }}>
              <div className="aug-icon-box">
                {selectedAugmentToUse.icon || augmentIconMap[selectedAugmentToUse.id] || '❓'}
              </div>
              <div className="aug-info-box">
                <span className="aug-name">{selectedAugmentToUse.name}</span>
                <p className="aug-desc">{selectedAugmentToUse.description}</p>
              </div>
              {selectedAugmentToUse.rarity && (
                <span className={`aug-rarity ${String(selectedAugmentToUse.rarity).toLowerCase()}`}>
                  {selectedAugmentToUse.rarity}
                </span>
              )}
            </div>

            <div className="action-row" style={{ display: 'flex', gap: '8px' }}>
              <button
                className="game-btn ghost"
                style={{ flex: 1, background: '#fffefb', border: '1.5px solid var(--card-border)', color: 'var(--text-main)' }}
                onClick={() => setSelectedAugmentToUse(null)}
              >
                취소
              </button>
              <button
                className="game-btn"
                style={{ flex: 1, background: 'var(--teal)', color: '#0e3833', border: 'none' }}
                onClick={handleConfirmUseAugment}
              >
                사용하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};