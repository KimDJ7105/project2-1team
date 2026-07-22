// client/src/components/History/HistoryDetail.tsx
import React from 'react';

interface GameRecord {
  id: number;
  result: 'win' | 'lose' | 'draw';
  opponent: string;
  turns: number;
}

interface HistoryDetailProps {
  game: GameRecord;
  onBackClick: () => void;
}

const resultLabel: Record<string, string> = {
  win: '승리',
  lose: '패배',
  draw: '무승부',
};

export default function HistoryDetail({ game, onBackClick }: HistoryDetailProps) {
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
            <span className="muted" style={{ fontSize: '12px' }}>나</span>
          </div>
          <span
            className="badge"
            style={{ fontSize: '13px', padding: '3px 10px' }}
          >
            {resultLabel[game.result]}
          </span>
          <div style={{ textAlign: 'center' }}>
            <div className="avatar">☁️</div>
            <span className="muted" style={{ fontSize: '12px' }}>{game.opponent}</span>
          </div>
        </div>

        <div className="list-item" style={{ justifyContent: 'space-between' }}>
          <span>총 턴 수</span>
          <b>{game.turns}턴</b>
        </div>
        {/* TODO: 나중에 API 연결되면 실제 사용 증강 데이터로 교체 */}
        <div className="list-item" style={{ justifyContent: 'space-between' }}>
          <span>내가 쓴 증강</span>
          <span>➕ ⏳</span>
        </div>
        <div className="list-item" style={{ justifyContent: 'space-between' }}>
          <span>상대가 쓴 증강</span>
          <span>✖️</span>
        </div>

        <div style={{ flex: 1 }}></div>

        <button className="btn ghost" onClick={onBackClick}>
          전적 목록으로
        </button>
      </div>
    </div>
  );
}