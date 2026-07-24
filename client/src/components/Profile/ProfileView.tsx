// client/src/components/Profile/ProfileView.tsx

import '../../assets/styles/ProfileStyles.css';
import { BottomNav } from '../Game/BottomNav';
import { useState } from 'react';

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
  onHistoryClick: () => void;
}

export default function ProfileView({
  onEditClick,
  profile,
  onBackClick,
  onHistoryClick,
}: ProfileViewProps) {


  function ProfileImage({ src, alt }: { src: string; alt?: string }) {
    const [error, setError] = useState(false);

    if (error) {
      return <div className="profile-avatar-view__fallback">🦁</div>;
    }

    return (
      <img
        className="profile-avatar-view__image"
        src={src}
        alt={alt}
        onError={() => setError(true)}
      />
    );
  }

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
          <div style={{ margin: '0 auto 8px' }}>
            <div className="profile-avatar-view">
              {
                profile.profileImage
                  ? <ProfileImage src={profile.profileImage} alt="프로필" />
                  : <div className="profile-avatar-view__fallback">🦁</div>
              }
            </div>
          </div>

          <b>{profile.nickname}</b>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
            marginTop: 14
          }}
        >
          <div className="list-item">
            <span className="muted" style={{ fontSize: 12 }}>총 게임</span>
            <b style={{ fontSize: 15 }}>{profile.totalGames}</b>
          </div>

          <div className="list-item">
            <span className="muted" style={{ fontSize: 12 }}>승률</span>
            <b style={{ fontSize: 15 }}>{profile.winRate}%</b>
          </div>

          <div className="list-item">
            <span className="muted" style={{ fontSize: 12 }}>승/패/무</span>
            <b style={{ fontSize: 13 }}>
              {profile.winCount}/{profile.loseCount}/{profile.drawCount}
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

      <BottomNav
        onHomeClick={onBackClick}
        onHistoryClick={onHistoryClick}
      />
    </div>
  );
}