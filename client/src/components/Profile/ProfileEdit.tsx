import { useState } from 'react';
import type { ChangeEvent } from 'react';
import '../../assets/styles/ProfileStyles.css';
import { getProfileUploadUrl, updateProfile } from '../../api/profileApi';

interface ProfileEditViewProps {
  nickname: string;
  email: string;
  userId: number;
  profileImage?: string | null;
  onSave: () => void;
  onBackClick: () => void;
}

export default function ProfileEditView({
  nickname,
  email,
  userId,
  profileImage,
  onSave,
  onBackClick,
}: ProfileEditViewProps) {

  const [editNickname, setEditNickname] = useState(nickname);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(profileImage ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleImageChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadProfileImage = async () => {
    if (!selectedImage) {
      return null;
    }

    const data = await getProfileUploadUrl(email, selectedImage.type);

    await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': selectedImage.type,
      },
      body: selectedImage,
    });

    return data.key;
  };

  const handleSave = async () => {
    setErrorMessage('');
    setIsSaving(true);

    try {
      const imagePath = await uploadProfileImage();

      // profileImage는 새로 선택된 이미지가 있는 경우에만 전달
      if (imagePath) {
        await updateProfile(userId, editNickname, imagePath);
      } else {
        await updateProfile(userId, editNickname, undefined as any);
      }

      onSave();
    } catch (error: any) {
      console.error('프로필 저장 실패:', error);
      setErrorMessage(
        error.response?.data?.message || error.message || '저장에 실패했습니다.'
      );
    } finally {
      setIsSaving(false);
    }
  };

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

          <b
            style={{ cursor: 'pointer' }}
            onClick={onBackClick}
          >
            프로필 편집
          </b>
        </div>

        <div
          style={{
            textAlign: 'center',
            margin: '30px 0'
          }}
        >

          <div
            className="avatar lg"
            style={{
              margin: '0 auto 15px',
              overflow: 'hidden'
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="미리보기"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              '🦁'
            )}
          </div>

          <button
            className="profile-btn ghost"
            onClick={() =>
              document.getElementById('profile-image-input')?.click()
            }
          >
            사진 변경
          </button>

          <input
            id="profile-image-input"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageChange}
          />

        </div>

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

        {errorMessage && (
          <p style={{ color: '#d1453b', fontSize: 13, textAlign: 'center', marginTop: 10 }}>
            {errorMessage}
          </p>
        )}

        <div style={{ flex: 1 }}></div>

        <button
          className="profile-btn ghost"
          onClick={onBackClick}
        >
          취소
        </button>

        <button
          className="profile-btn"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>

      </div>

    </div>
  );
}