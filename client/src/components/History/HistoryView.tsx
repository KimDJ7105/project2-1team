// client/src/components/History/HistoryView.tsx
import React, { useState } from 'react';
import HistoryDetail from './HistoryDetail';
import { BottomNav } from '../Game/BottomNav';

interface HistoryViewProps {
  onBackClick: () => void;
  onProfileClick: () => void;
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

export default function HistoryView({ onBackClick, onProfileClick }: HistoryViewProps) {
  const [selectedGame, setSelectedGame] = useState<GameRecord | null>(null);

  // TODO: 나중에 API 연결되면 이 하드코딩 데이터를 실제 데이터로 교체
  const history: GameRecord[] = [
    { id: 1, result: 'win', opponent: '구름(백)', turns: 43 },
    { id: 2, result: 'lose', opponent: '번개(흑)', turns: 28 },
    { id: 3, result: 'win', opponent: '오목의 신(백)', turns: 31 },
    { id: 4, result: 'draw', opponent: '달빛(흑)', turns: 57 },
  ];

  if (selectedGame) {
    return (
      <HistoryDetail
        game={selectedGame}
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