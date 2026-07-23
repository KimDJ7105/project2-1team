// server/src/controllers/userController.ts
import { Request, Response } from 'express';
import { userService } from '../services/userService';
import { s3Service } from '../services/s3Service';
import { redisSessionManager } from '../sessions/redisSessionManager';
import { disconnectTimerManager } from '../sessions/disconnectTimerManager';

export class UserController {
  // 1. 회원가입 요청 처리
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, nickname } = req.body;

      // 필수값 검증
      if (!email || !password || !nickname) {
        res.status(400).json({ message: '이메일, 비밀번호, 닉네임은 필수 입력 항목입니다.' });
        return;
      }

      // 서비스 레이어 호출
      const newUser = await userService.register(email, password, nickname);

      // 성공 응답 반환
      res.status(201).json({
        message: '회원가입이 성공적으로 완료되었습니다.',
        user: newUser,
      });
    } catch (error: any) {
      // 이미 사용 중인 이메일 등 예외 발생 시 에러 처리
      res.status(400).json({ message: error.message });
    }
  }

  // 2. 로그인 요청 처리
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // 필수값 검증
      if (!email || !password) {
        res.status(400).json({ message: '이메일과 비밀번호를 입력해 주세요.' });
        return;
      }

      // 비밀번호 검증 
      const user = await userService.login(email, password);

      // 3) 기존 세션 존재 여부 확인 및 강제 밀어내기 처리
      const existingSessionId = await redisSessionManager.getActiveSessionByEmail(email);
      if (existingSessionId) {
        console.log(`[중복 로그인 감지] 기존 세션을 강제 종료하고 새 로그인을 진행합니다: ${email}`);
        
        // 소켓 종료 대기 타이머가 돌고 있다면 즉시 취소
        if (disconnectTimerManager.has(email)) {
          disconnectTimerManager.clear(email);
        }

        // Redis에 남아있는 기존 유령/활성 세션 파기
        await redisSessionManager.destroySession(existingSessionId);
      }

      // 세션 유지 시간 설정 : 1시간
      const ttlSeconds = 3600;

      // Redis 세션 데이터 생성 (소켓 검증 등에서 유저 식별에 쓸 데이터 기입)
      // profileImage가 S3 key일 경우 presigned GET URL로 변환
      const signedProfile = await s3Service.getProfilePresignedGetUrl(user.profileImage ?? null);

      const sessionId = await redisSessionManager.createSession(
        user.email,
        {
          userId: user.userId,
          email: user.email,
          nickname: user.nickname,
          profileImage: signedProfile,
        },
        ttlSeconds
      );


      // 성공 응답 반환
      res.status(200).json({
        message: '로그인에 성공했습니다.',
        token: sessionId,
        user: {
          ...user,
          profileImage: signedProfile ?? null,
        },
      });
    } catch (error: any) {
      // 가입되지 않은 이메일, 비밀번호 불일치 등 예외 처리
      res.status(400).json({ message: error.message });
    }
  }

  // 3. 로그아웃 요청 처리
  async logout(req: Request, res: Response): Promise<void> {
    try {
      // Authorization 헤더 또는 바디에서 토큰 추출
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.split(' ')[1] : req.body.token;

      if (!token) {
        res.status(400).json({ message: '로그아웃할 토큰이 제공되지 않았습니다.' });
        return;
      }

      // Redis에서 세션 정보 삭제
      await redisSessionManager.destroySession(token);

      res.status(200).json({ message: '로그아웃이 성공적으로 완료되었습니다.' });
    } catch (error: any) {
      res.status(500).json({ message: '로그아웃 처리 중 서버 오류가 발생했습니다.' });
    }
  }

  //4. 토큰 검색 처리 
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.split(' ')[1] : null;

      if (!token) {
        res.status(401).json({ message: '인증 토큰이 없습니다.' });
        return;
      }

      // Redis에서 세션 정보 조회
      const sessionData = await redisSessionManager.getSession(token);

      if (!sessionData) {
        res.status(401).json({ message: '유효하지 않거나 만료된 세션입니다.' });
        return;
      }

      // 세션에 저장되어 있던 유저 정보 반환
      res.status(200).json({
        user: {
          userId: sessionData.userId,
          email: sessionData.email,
          nickname: sessionData.nickname
        }
      });
    } catch (error: any) {
      console.error('[GetMe Error]:', error);
      res.status(500).json({ message: '내 정보 조회 중 오류가 발생했습니다.' });
    }
  }
}

// 싱글톤 컨트롤러 인스턴스 제공
export const userController = new UserController();