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

  const response = await API.get(
    `/api/profile?userId=${userId}`
  );

  return response.data;

};


// 닉네임 변경
export const updateNickname = async (
  userId: number,
  nickname: string
) => {

  const response = await API.patch(
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
  email: string
) => {

  const response = await API.get(
    "/api/profile/upload-url",
    {
      params: {
        email
      }
    }
  );


  return response.data;

};
// 프로필 수정
export const updateProfile = async (
  userId: number,
  nickname: string,
  profileImage: string
) => {

  const response = await API.put(
    "/api/profile",
    {
      userId,
      nickname,
      profileImage
    }
  );


  return response.data;

};