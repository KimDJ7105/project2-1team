import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});


// 프로필 조회 응답 타입
export interface ProfileResponse {
  nickname: string;
  profileImage: string | null;

  totalGames: number;
  winCount: number;
  loseCount: number;
  drawCount: number;

  rating: number;
  winRate: number;
}


// 프로필 조회
export const getProfile = async (
  userId: number
): Promise<ProfileResponse> => {

  const token = sessionStorage.getItem('token');

  const response = await API.get(
    `/api/profile?userId=${userId}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  );

  return response.data;

};


// 닉네임 변경
export const updateNickname = async (
  userId: number,
  nickname: string
) => {

  const response = await API.put(
    "/api/profile/nickname",
    {
      userId,
      nickname,
    }
  );

  return response.data;

};

// 프로필 이미지 업로드용 Presigned URL 요청
export const getProfileUploadUrl = async (
  email: string,
  contentType?: string
) => {

  const token = sessionStorage.getItem('token');

  const response = await API.get(
    "/api/profile/upload-url",
    {
      params: {
        email,
        contentType
      },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  );


  return response.data;

};
// 프로필 수정
export const updateProfile = async (
  userId: number,
  nickname: string,
  profileImage?: string
) => {
  const token = sessionStorage.getItem('token');

  const body: any = {
    userId,
    nickname,
  };

  if (profileImage !== undefined && profileImage !== null && profileImage !== '') {
    body.profileImage = profileImage;
  }

  const response = await API.put(
    "/api/profile",
    body,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  );


  return response.data;

};