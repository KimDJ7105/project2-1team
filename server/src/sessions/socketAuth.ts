// server/src/sessions/socketAuth.ts
import { Socket } from 'socket.io';
import { redisSessionManager } from './redisSessionManager';

// 소켓 객체에 유저 정보를 심어주기 위한 인터페이스
export interface AuthenticatedSocket extends Socket {
  user?: {
    userId: number;
    email: string;
    nickname: string;
    profileImage?: string | null;
  };
}

export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => {
  try {
    // 클라이언트가 소켓 연결 시 보낸 토큰 추출
    const token = socket.handshake.auth.token;

    if (!token || typeof token !== 'string') {
      return next(new Error('인증 토큰이 누락되었습니다.'));
    }

    // Redis에서 세션 정보 조회
    const session = await redisSessionManager.getSession(token);

    if (!session) {
      return next(new Error('유효하지 않거나 만료된 세션입니다.'));
    }

    // 검증에 성공하면 소켓 객체에 유저 정보를 바인딩하여, 이후 게임 로직에서 바로 쓸 수 있도록 처리
    socket.user = {
      userId: session.userId,
      email: session.email, // createSession 호출 시 넣어준 email
      nickname: session.nickname,
      profileImage: session.profileImage ?? null,
    };

    // 활동 중이므로 세션 시간 연장
    await redisSessionManager.touchSession(token, 3600);

    // 다음 관문으로 통과
    next();
  } catch (error) {
    console.error('소켓 인증 미들웨어 에러:', error);
    next(new Error('서버 인증 처리 중 오류가 발생했습니다.'));
  }
};