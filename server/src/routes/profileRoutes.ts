import { Router } from 'express';
import { profileController } from '../controllers/profileController';

const router = Router();


// 프로필 조회
router.get(
  '/',
  profileController.getProfile
);


// 닉네임 변경
router.put(
  '/nickname',
  profileController.updateNickname
);


export default router;