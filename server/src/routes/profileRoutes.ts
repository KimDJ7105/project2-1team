// server/src/routes/profileRoutes.ts

import { Router } from 'express';
import { profileController } from '../controllers/profileController';

const router = Router();


// 프로필 조회
router.get(
  '/',
  profileController.getProfile
);


export default router;