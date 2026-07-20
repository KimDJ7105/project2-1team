// server/src/controllers/userController.ts
import { Request, Response } from 'express';
import { userService } from '../services/userService';
import { redisSessionManager } from '../sessions/redisSessionManager';

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

      // 중복 로그인 검사 
      const existingSessionId = await redisSessionManager.getActiveSessionByEmail(email);
      if (existingSessionId) {
        res.status(409).json({
          message: '이미 접속 중인 아이디입니다. 기존 접속을 해제하거나 잠시 후 다시 시도해주세요.'
        });
        return;
      }

      // 필수값 검증
      if (!email || !password) {
        res.status(400).json({ message: '이메일과 비밀번호를 입력해 주세요.' });
        return;
      }

      // 서비스 레이어 호출
      const user = await userService.login(email, password);

      // 세션 유지 시간 설정 : 1시간
      const ttlSeconds = 3600;

      // Redis 세션 데이터 생성 (소켓 검증 등에서 유저 식별에 쓸 데이터 기입)
      const sessionId = await redisSessionManager.createSession(
        user.email,
        { 
          email: user.email, 
          nickname: user.nickname 
        },
        ttlSeconds
      );


      // 성공 응답 반환
      res.status(200).json({
        message: '로그인에 성공했습니다.',
        token: sessionId,
        user,
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