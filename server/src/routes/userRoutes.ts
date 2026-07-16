// server/src/routes/userRoutes.ts
import { Router } from 'express';
import { userController } from '../controllers/userController';

const router = Router();

// 회원가입 경로 연결 (POST /api/users/register)
router.post('/register', userController.register);

// 로그인 경로 연결 (POST /api/users/login)
router.post('/login', userController.login);

export default router;