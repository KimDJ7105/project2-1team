// client/src/components/History/HistoryDetail.tsx
import { useState, useEffect } from 'react';
import { getGameRecordDetail } from '../../api/gameRecordApi';
import '../../assets/styles/GameStyles.css';

const augmentIconMap: Record<string, string> = {
  sniper: '🎯', seal_empty: '🚫', coin_flip: '🪙', double_coin: '🔀',
  chaos_party: '🌈', hidden_move: '🥷', fog_of_war: '🌫️', mixer: '🌪️',
  meteor: '☄️', different_game: '🧩', peek: '👁️', confiscate: '🔒',
  steal: '🦹', bombardment: '💣', table_flip: '┻━┻', undo: '⏪'
};

const augmentNameMap: Record<string, string> = {
  sniper: '저격', seal_empty: '봉인', coin_flip: '동전 뒤집기', double_coin: '더블 코인',
  chaos_party: '대환장 파티', hidden_move: '숨겨진 수', fog_of_war: '전장의 안개', mixer: '믹서',
  meteor: '운석 충돌', different_game: '다른 게임', peek: '엿보기', confiscate: '몰수',
  steal: '도둑질', bombardment: '폭격', table_flip: '판 뒤엎기', undo: '되돌리기'
};

interface HistoryDetailProps {
  gameId: number;
  userId: number;
  onBackClick: () => void;
}

interface GameRecordDetail {
  gameId: number;
  blackNickname: string;
  blackProfileImage: string | null;
  whiteNickname: string;
  whiteProfileImage: string | null;
  winnerUserId: number | null;
  boardState: string[][];
  endReason: string;
  totalTurn: number;
  startedAt: string;
  endedAt: string;
  selectedAugment: { black: string[]; white: string[] } | null;
  blackUserId: number;
  whiteUserId: number;
}

const resultLabel: Record<string, string> = {
  win: '승리',
  lose: '패배',
  draw: '무승부',
};

export default function HistoryDetail({ gameId, userId, onBackClick }: HistoryDetailProps) {
  const [detail, setDetail] = useState<GameRecordDetail | null>(null);

  useEffect(() => {
    getGameRecordDetail(gameId)
      .then((data) => {
        console.log('대국 상세 데이터:', data);
        setDetail(data);
      })
      .catch((error) => {
        console.error('대국 상세 조회 실패:', error);
      });
  }, [gameId]);

  if (!detail) {
    return (
      <div className="phone">
        <div className="pad flex-col flex-1">
          <p className="muted" style={{ textAlign: 'center', marginTop: '40px' }}>
            불러오는 중...
          </p>
        </div>
      </div>
    );
  }

  // 내가 흑돌인지 백돌인지 판단
  const isMeBlack = detail.blackUserId === userId;
  const myNickname = isMeBlack ? detail.blackNickname : detail.whiteNickname;
  const opponentNickname = isMeBlack ? detail.whiteNickname : detail.blackNickname;

  // 결과 판정
  let result: 'win' | 'lose' | 'draw' = 'draw';
  if (detail.winnerUserId !== null) {
    result = detail.winnerUserId === userId ? 'win' : 'lose';
  }

  const myAugments = isMeBlack
    ? detail.selectedAugment?.black ?? []
    : detail.selectedAugment?.white ?? [];
  const opponentAugments = isMeBlack
    ? detail.selectedAugment?.white ?? []
    : detail.selectedAugment?.black ?? [];

  // 보드 픽셀 좌표 계산 (GamePage.tsx와 동일한 방식)
  const getStarPos = (gridPos: number) => `${14 + gridPos * 22}px`;

  const stones: { x: number; y: number; color: 'black' | 'white' }[] = [];
  const board = detail.boardState;
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const val = board?.[y]?.[x];
      if (val === 'black' || val === 'white') {
        stones.push({ x, y, color: val });
      }
    }
  }

  return (
    <div className="phone">
      <div className="pad flex-col flex-1" style={{ gap: '10px' }}>
        <div className="row" style={{ gap: '10px' }}>
          <span onClick={onBackClick} style={{ cursor: 'pointer', fontSize: '20px' }}>←</span>
          <b style={{ fontSize: '18px' }}>대국 상세</b>
        </div>

        <div className="row" style={{ justifyContent: 'center', gap: '16px', marginTop: '4px' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="avatar">🦁</div>
            <span className="muted" style={{ fontSize: '12px' }}>{myNickname} (나)</span>
          </div>
          <span className="badge" style={{ fontSize: '13px', padding: '3px 10px' }}>
            {resultLabel[result]}
          </span>
          <div style={{ textAlign: 'center' }}>
            <div className="avatar">☁️</div>
            <span className="muted" style={{ fontSize: '12px' }}>{opponentNickname}</span>
          </div>
        </div>

        {/* 보드판 - GamePage.tsx의 board 렌더링 재사용 (읽기 전용) */}
        <div className="board" style={{ pointerEvents: 'none' }}>
          <div className="grid-lines"></div>

          <div className="star-point" style={{ top: getStarPos(7), left: getStarPos(7) }}></div>
          <div className="star-point" style={{ top: getStarPos(3), left: getStarPos(3) }}></div>
          <div className="star-point" style={{ top: getStarPos(3), left: getStarPos(11) }}></div>
          <div className="star-point" style={{ top: getStarPos(11), left: getStarPos(3) }}></div>
          <div className="star-point" style={{ top: getStarPos(11), left: getStarPos(11) }}></div>

          {stones.map((stone, idx) => {
            const pixelX = 2 + 14 + stone.x * 22;
            const pixelY = 2 + 14 + stone.y * 22;
            const stoneClass = `stone ${stone.color === 'black' ? 'b' : 'w'}`;
            return (
              <div
                key={idx}
                className={stoneClass}
                style={{ top: `${pixelY}px`, left: `${pixelX}px` }}
              ></div>
            );
          })}
        </div>

        <div className="list-item" style={{ justifyContent: 'space-between' }}>
          <span>총 턴 수</span>
          <b>{detail.totalTurn}턴</b>
        </div>

        <div className="list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '6px' }}>
          <span className="muted">내가 쓴 증강</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {myAugments.length > 0 ? (
              myAugments.map((augId, idx) => (
                <span key={idx} style={{ background: '#f0dfc0', padding: '2px 8px', borderRadius: '6px', fontSize: '13px', fontWeight: 700 }}>
                  {augmentIconMap[augId] || '🃏'} {augmentNameMap[augId] || augId}
                </span>
              ))
            ) : (
              <span className="muted">없음</span>
            )}
          </div>
        </div>

      <div className="list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '6px' }}>
        <span className="muted">상대가 쓴 증강</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {opponentAugments.length > 0 ? (
            opponentAugments.map((augId, idx) => (
              <span key={idx} style={{ background: '#f0dfc0', padding: '2px 8px', borderRadius: '6px', fontSize: '13px', fontWeight: 700 }}>
                {augmentIconMap[augId] || '🃏'} {augmentNameMap[augId] || augId}
              </span>
            ))
          ) : (
            <span className="muted">없음</span>
          )}
        </div>
      </div>

        <div style={{ flex: 1 }}></div>

        <button className="btn ghost" onClick={onBackClick}>
          전적 목록으로
        </button>
      </div>
    </div>
  );
}