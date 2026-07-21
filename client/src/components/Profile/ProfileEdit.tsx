import React, { useState } from 'react';
import '../../assets/styles/ProfileStyles.css';

interface ProfileEditViewProps {
  nickname: string;
  onSave: (nickname: string) => void;
  onBackClick: () => void;
}

export default function ProfileEditView({
  nickname,
  onSave,
  onBackClick,
}: ProfileEditViewProps) {
  const [editNickname, setEditNickname] = useState(nickname);

  return (
    <div className="phone">

      <div className="pad">

        {/* 상단 제목 */}
        <div className="row">
          <span 
            style={{ cursor: 'pointer' }}
            onClick={onBackClick}
          >
            ←
          </span>

          <b
            style={{ cursor: 'pointer' }}
            onClick={onBackClick}
          >
            프로필 편집
          </b>
        </div>


        {/* 프로필 사진 영역 */}
        <div
          style={{
            textAlign: 'center',
            margin: '30px 0'
          }}
        >

          <div
            className="avatar lg"
            style={{
              margin: '0 auto 15px'
            }}
          >
            🦁
          </div>


          <button className="profile-btn ghost">
            사진 변경
          </button>

        </div>


        {/* 닉네임 */}
        <div className="list-item">

          <span className="muted">
            닉네임
          </span>

          <input
            type="text"
            value={editNickname}
            onChange={(e) => setEditNickname(e.target.value)}
          />

        </div>


        <div style={{ flex: 1 }}></div>


        {/* 버튼 */}
        <button
          className="profile-btn ghost"
          onClick={onBackClick}
        >
          취소
        </button>


        <button
          className="profile-btn"
          onClick={() => onSave(editNickname)}
        >
          저장
        </button>


      </div>


    </div>
  );
}