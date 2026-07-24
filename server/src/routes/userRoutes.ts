// server/src/routes/userRoutes.ts
import { Router } from 'express';
import { userController } from '../controllers/userController';

const router = Router();

// 회원가입 경로 연결 (POST /api/users/register)
router.post('/register', userController.register);

// 로그인 경로 연결 (POST /api/users/login)
router.post('/login', userController.login);

// 로그아웃 경로 연결 (POST /api/users/logout)
router.post('/logout', userController.logout);

// 내 정보 조회 / 세션 검증 경로 연결 (GET /api/users/me)
router.get('/me', userController.getMe);

export default router;