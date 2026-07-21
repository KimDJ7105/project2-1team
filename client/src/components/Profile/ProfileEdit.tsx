import React, { useState } from 'react';
import type { ChangeEvent } from 'react';
import '../../assets/styles/ProfileStyles.css';
import { getProfileUploadUrl, updateProfile } from '../../api/profileApi';

interface ProfileEditViewProps {
  nickname: string;
  email:string;
  userId: number,
  onSave: (nickname: string) => void;
  onBackClick: () => void;
}

export default function ProfileEditView({
  nickname,
  email,
  userId,
  onSave, 
  onBackClick,
}: ProfileEditViewProps) {

  const [editNickname, setEditNickname] = useState(nickname);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);


  const handleImageChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {

    const file = e.target.files?.[0];

    if (!file) return;

    setSelectedImage(file);

  };

  const uploadProfileImage = async () => {

  if (!selectedImage) {
    return null;
  }


  const data = await getProfileUploadUrl(email);


  await fetch(data.uploadUrl, {

    method:"PUT",

    headers:{
      "Content-Type": selectedImage.type,
    },

    body:selectedImage,

  });


  return data.key;

};



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
 onClick={async () => {

    const imagePath =
      await uploadProfileImage();


    await updateProfile(
      userId,
      editNickname,
      imagePath ?? ""
    );


    onSave(editNickname);

 }}
>
 저장
</button>


      </div>


    </div>
  );
}