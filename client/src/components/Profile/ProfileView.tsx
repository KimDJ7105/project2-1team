// client/src/components/Profile/ProfileView.tsx
import React from 'react';
import '../../assets/styles/ProfileStyles.css';

interface ProfileViewProps {
  onEditClick: () => void;
}

export default function ProfileView({ onEditClick }: ProfileViewProps) {
  // TODO: 나중에 API 생기면 이 하드코딩된 값들을 실제 데이터로 교체
  const nickname = '사자';
  const level = 12;
  const stats = {
    totalGames: 52,
    winRate: 59.6,
    win: 31,
    lose: 19,
    draw: 2,
    rating: 1210,
  };

  return (
    <div className="phone">
      <div className="pad">
        <div className="row">
          <span style={{ cursor: 'pointer' }}>←</span>
          <b>프로필</b>
        </div>

        <div style={{ textAlign: 'center', margin: '16px 0 6px' }}>
          <div className="avatar lg" style={{ margin: '0 auto 8px' }}>
            🦁
          </div>
          <b>{nickname}</b>
          <br />
          <span className="badge">Lv.{level}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          <div className="list-item">
            <span className="muted" style={{ fontSize: 12 }}>총 게임</span>
            <b style={{ fontSize: 15 }}>{stats.totalGames}</b>
          </div>
          <div className="list-item">
            <span className="muted" style={{ fontSize: 12 }}>승률</span>
            <b style={{ fontSize: 15 }}>{stats.winRate}%</b>
          </div>
          <div className="list-item">
            <span className="muted" style={{ fontSize: 12 }}>승/패/무</span>
            <b style={{ fontSize: 13 }}>
              {stats.win}/{stats.lose}/{stats.draw}
            </b>
          </div>
          <div className="list-item">
            <span className="muted" style={{ fontSize: 12 }}>레이팅</span>
            <b style={{ fontSize: 15 }}>{stats.rating}</b>
          </div>
        </div>

        <div style={{ flex: 1 }}></div>

        <button className="profile-btn ghost" onClick={onEditClick}>
          프로필 편집 →
        </button>
      </div>

      <div className="bottom-nav">
        <div className="item">🏠<span>홈</span></div>
        <div className="item">📊<span>전적</span></div>
        <div className="item">📖<span>도감</span></div>
        <div className="item active">👤<span>프로필</span></div>
      </div>
    </div>
  );
}