// client/src/components/History/HistoryView.tsx
import React, { useState, useEffect} from 'react';
import HistoryDetail from './HistoryDetail';
import { BottomNav } from '../Game/BottomNav';
import { getGameRecords } from '../../api/gameRecordApi';

interface HistoryViewProps {
  onBackClick: () => void;
  onProfileClick: () => void;
  userId: number;
}

interface GameRecord {
  id: number;
  result: 'win' | 'lose' | 'draw';
  opponent: string;
  turns: number;
}

const badgeStyle: Record<string, React.CSSProperties> = {
  win: { background: 'var(--teal)', color: '#0e3833' },
  lose: { background: '#f3c3b8', color: '#7a2a1c' },
  draw: { background: '#e2d8c2', color: 'var(--text-main)' },
};

const badgeLabel: Record<string, string> = {
  win: '승',
  lose: '패',
  draw: '무',
};

export default function HistoryView({ onBackClick, onProfileClick, userId }: HistoryViewProps) {
  const [selectedGame, setSelectedGame] = useState<GameRecord | null>(null);
const [history, setHistory] = useState<GameRecord[]>([]);
 
useEffect(() => {
  getGameRecords(userId)
    .then((data) => {
      console.log("전적 데이터:", data);

      const formatted = data.map((item: any) => ({
        id: item.gameId,
        result: item.result,
        opponent: item.opponentNickname,
        turns: item.totalTurn,
      }));

      setHistory(formatted);
    })
    .catch((error) => {
      console.error("전적 조회 실패:", error);
    });

}, [userId]);


  if (selectedGame) {
  return (
    <HistoryDetail
      gameId={selectedGame.id}
      userId={userId}
      onBackClick={() => setSelectedGame(null)}
      />
    );
  }

  return (
    <div className="phone">
      <div className="pad flex-col flex-1" style={{ gap: '10px' }}>
        <div className="row" style={{ gap: '10px' }}>
          <span onClick={onBackClick} style={{ cursor: 'pointer', fontSize: '20px' }}>←</span>
          <b style={{ fontSize: '18px' }}>전적 조회</b>
        </div>

        <p className="muted" style={{ fontSize: '13px', margin: 0 }}>최근 대국 목록</p>

        {history.map((game) => (
          <div
            key={game.id}
            className="list-item"
            style={{ cursor: 'pointer', justifyContent: 'space-between' }}
            onClick={() => setSelectedGame(game)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="badge"
                style={{
                  ...badgeStyle[game.result],
                  padding: '3px 9px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {badgeLabel[game.result]}
              </span>
              vs {game.opponent}
            </span>
            <span className="muted">{game.turns}턴 →</span>
          </div>
        ))}

        <p className="muted" style={{ fontSize: '12px', textAlign: 'center', marginTop: 'auto' }}>
          행을 누르면 상세 기록으로 이동해요
        </p>
      </div>

      <BottomNav
        onHomeClick={onBackClick}
        onProfileClick={onProfileClick}
      />
    </div>
  );
}