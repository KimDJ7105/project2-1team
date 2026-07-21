import { useState } from 'react';
import '../../assets/styles/ProfileEdit.css';

interface ProfileEditProps {
  onSave: () => void;
  onCancel: () => void;
}

export default function ProfileEdit({
  onSave,
  onCancel,
}: ProfileEditProps) {
  const [nickname, setNickname] = useState('사자');
  const [intro, setIntro] = useState('오늘도 오목 한 판 어때요?');

  return (
    <div className="phone">
      <div className="pad">

        <div className="row">
          <span style={{ cursor: 'pointer' }} onClick={onCancel}>
            ←
          </span>
          <b>프로필 편집</b>
        </div>

        <div className="profile-image-area">
          <div className="avatar xl">
            🦁
            <div className="camera-btn">📷</div>
          </div>

          <p className="muted">
            사진을 눌러 변경
          </p>
        </div>

        <div className="input-group">
          <label>닉네임</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>한 줄 소개</label>
          <textarea
            rows={3}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
          />
        </div>

        <div style={{ flex: 1 }} />

        <div className="button-row">
          <button
            className="profile-btn ghost"
            onClick={onCancel}
          >
            취소
          </button>

          <button
            className="profile-btn save"
            onClick={onSave}
          >
            저장 →
          </button>
        </div>

      </div>
    </div>
  );
}