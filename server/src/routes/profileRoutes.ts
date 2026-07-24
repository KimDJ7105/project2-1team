import { Router } from 'express';
import { profileController } from '../controllers/profileController';

const router = Router();


// 프로필 조회
router.get(
  '/',
  profileController.getProfile
);

// 프로필 이미지 업로드 URL 발급
router.get(
  '/upload-url',
  profileController.getUploadUrl
);

// 프로필 수정
router.put(
  '/',
  profileController.updateProfile
);

// 닉네임 변경
router.put(
  '/nickname',
  profileController.updateNickname
);


export default router;