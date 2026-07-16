// client/src/api/auth.ts
// 회원가입 및 로그인을 처리하는 api 


import axios from 'axios';

// 백엔드 Express 서버 주소를 베이스 URL로 설정
const API = axios.create({
  baseURL: 'http://localhost:8080/api/users',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // CORS 상황에서 쿠키나 세션 인증 정보를 주고받기 위한 설정
});

// 회원가입 요청 시 보낼 데이터 타입 정의
export interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
}

// 로그인 요청 시 보낼 데이터 타입 정의
export interface LoginRequest {
  email: string;
  password: string;
}

// 로그인 성공 시 받아올 유저 정보 데이터 타입 정의 (비밀번호 제외)
export interface UserResponse {
  userId: number;
  email: string;
  nickname: string;
  profileImage: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  status: 'ACTIVE' | 'BANNED' | 'DELETED';
}

// 서버 응답의 공통 포맷 정의
export interface AuthResponse {
  message: string;
  user: UserResponse;
}

// 1. 회원가입 API 호출 함수
export const registerAPI = async (data: RegisterRequest): Promise<AuthResponse> => {
  const response = await API.post<AuthResponse>('/register', data);
  return response.data;
};

// 2. 로그인 API 호출 함수
export const loginAPI = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await API.post<AuthResponse>('/login', data);
  return response.data;
};