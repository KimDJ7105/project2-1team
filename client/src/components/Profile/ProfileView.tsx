// client/src/components/Profile/ProfileView.tsx

import React from 'react';
import '../../assets/styles/ProfileStyles.css';

interface ProfileData {
  nickname: string;
  profileImage: string | null;

  totalGames: number;
  winCount: number;
  loseCount: number;
  drawCount: number;

  rating: number;
  winRate: number;
}

interface ProfileViewProps {
  onEditClick: () => void;
  profile: ProfileData;
  onBackClick: () => void;
}

export default function ProfileView({
  onEditClick,
  profile,
  onBackClick,
}: ProfileViewProps) {

  const level = 12; // 추후 레벨 시스템 추가 시 API 데이터로 변경

  return (
    <div className="phone">
      <div className="pad">

        <div className="row">
          <span 
              style={{ cursor: 'pointer' }}
              onClick={onBackClick}
          >
            ←
          </span>
          <b>프로필</b>
        </div>


        <div style={{ textAlign: 'center', margin: '16px 0 6px' }}>

          <div
            className="avatar lg"
            style={{ margin: '0 auto 8px' }}
          >
            {
              profile.profileImage
                ? <img 
                    src={profile.profileImage}
                    alt="프로필"
                  />
                : '🦁'
            }
          </div>

          <b>{profile.nickname}</b>

          <br />

          <span className="badge">
            Lv.{level}
          </span>

        </div>


        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginTop: 14
          }}
        >

          <div className="list-item">
            <span
              className="muted"
              style={{ fontSize: 12 }}
            >
              총 게임
            </span>

            <b style={{ fontSize: 15 }}>
              {profile.totalGames}
            </b>
          </div>


          <div className="list-item">
            <span
              className="muted"
              style={{ fontSize: 12 }}
            >
              승률
            </span>

            <b style={{ fontSize: 15 }}>
              {profile.winRate}%
            </b>
          </div>


          <div className="list-item">
            <span
              className="muted"
              style={{ fontSize: 12 }}
            >
              승/패/무
            </span>

            <b style={{ fontSize: 13 }}>
              {profile.winCount}
              /
              {profile.loseCount}
              /
              {profile.drawCount}
            </b>
          </div>


          <div className="list-item">
            <span
              className="muted"
              style={{ fontSize: 12 }}
            >
              레이팅
            </span>

            <b style={{ fontSize: 15 }}>
              {profile.rating}
            </b>
          </div>

        </div>


        <div style={{ flex: 1 }}></div>


        <button
          className="profile-btn ghost"
          onClick={onEditClick}
        >
          프로필 편집 →
        </button>

      </div>


      <div className="bottom-nav">

        <div
          className="item"
          onClick={onBackClick}
          style={{ cursor: 'pointer' }}
        >
          🏠
          <span>홈</span>
        </div>

        <div className="item">
          📊
          <span>전적</span>
        </div>

        <div className="item">
          📖
          <span>도감</span>
        </div>

        <div className="item active">
          👤
          <span>프로필</span>
        </div>

      </div>

    </div>
  );
}