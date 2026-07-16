// server/src/controllers/userController.ts
import { Request, Response } from 'express';
import { userService } from '../services/userService';

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

      // 서비스 레이어 호출
      const user = await userService.login(email, password);

      // 성공 응답 반환
      res.status(200).json({
        message: '로그인에 성공했습니다.',
        user,
      });
    } catch (error: any) {
      // 가입되지 않은 이메일, 비밀번호 불일치 등 예외 처리
      res.status(400).json({ message: error.message });
    }
  }
}

// 싱글톤 컨트롤러 인스턴스 제공
export const userController = new UserController();