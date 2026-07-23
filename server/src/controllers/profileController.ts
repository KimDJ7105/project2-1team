import { Request, Response } from 'express';
import { profileService } from '../services/profileService';
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../config/s3";
import { s3Service } from '../services/s3Service';
import { redisSessionManager } from '../sessions/redisSessionManager';
export class ProfileController {


  // 프로필 조회
  async getProfile(req: Request, res: Response) {

    try {

      const { userId } = req.query;


      const profile =
        await profileService.getProfile(Number(userId));

      // If profileImage is present (S3 object key), generate a presigned GET URL using shared helper
      if (profile && profile.profileImage) {
        profile.profileImage = await s3Service.getProfilePresignedGetUrl(profile.profileImage);
      }

      res.status(200).json(profile);


    } catch (error: any) {

      res.status(400).json({
        message: error.message
      });

    }

  }

  
// 낙네임 변경
 async updateNickname(req: Request, res: Response) {

    try {

      const {
        userId,
        nickname
      } = req.body;


      const result =
        await profileService.updateNickname(
          Number(userId),
          nickname
        );


      res.status(200).json(result);


    } catch (error: any) {

      res.status(400).json({
        message: error.message
      });

    }

  }

  // 프로필 이미지 업로드 URL 발급
async getUploadUrl(req: Request, res: Response) {

  try {

    const { email, contentType } = req.query;


    if (!email) {
      res.status(400).json({
        message: "EMAIL_REQUIRED"
      });
      return;
    }


    // contentType이 전달되면 extension을 유추
    const ct = typeof contentType === 'string' ? contentType : 'image/png';
    const ext = ct.split('/')[1] || 'png';
    const timestamp = Date.now();
    const key = `users/${email}/profile-${timestamp}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_PROFILE_BUCKET,
      Key: key,
      ContentType: ct,
    });


    const uploadUrl =
      await getSignedUrl(
        s3Client,
        command,
        {
          expiresIn: 60
        }
      );


    res.status(200).json({
      uploadUrl,
      key,
    });


  } catch(error:any) {

    res.status(500).json({
      message:error.message
    });

  }

}

// 프로필 수정
async updateProfile(req: Request, res: Response) {

  try {

    const {
      userId,
      nickname,
      profileImage
    } = req.body;


    const result = await profileService.updateProfile(Number(userId), nickname, profileImage);

    // profileImage가 키로 들어온 경우 presigned GET URL을 생성하여 클라이언트에 전달
    const profileUrl = await s3Service.getProfilePresignedGetUrl(result.profileImage);

    // 세션 토큰이 제공된 경우, 세션의 userId와 요청 userId가 같으면 세션을 갱신
    const authHeader = req.headers.authorization;
    const token = authHeader ? String(authHeader).split(' ')[1] : null;
    if (token) {
      try {
        const session = await redisSessionManager.getSession(token);
        if (session && session.userId === Number(userId)) {
          await redisSessionManager.updateSession(token, {
            nickname: result.nickname,
            profileImage: profileUrl,
          });
        }
      } catch (err) {
        console.warn('세션 갱신 중 오류:', err);
      }
    }

    res.status(200).json({ nickname: result.nickname, profileImage: profileUrl || null });


  } catch(error:any) {

    res.status(400).json({
      message:error.message
    });

  }

}

}

export const profileController = new ProfileController();
