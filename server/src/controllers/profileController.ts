import { Request, Response } from 'express';
import { profileService } from '../services/profileService';
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../config/s3";
import { s3Service } from '../services/s3Service';
export class ProfileController {


  // 프로필 조회
  async getProfile(req: Request, res: Response) {

    try {

      const { userId } = req.query;


      const profile =
        await profileService.getProfile(Number(userId));

      // If profileImage is present (S3 object key), generate a presigned GET URL
      if (profile && profile.profileImage) {
        const command = new GetObjectCommand({
          Bucket: process.env.S3_PROFILE_BUCKET,
          Key: profile.profileImage,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        profile.profileImage = url;
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

    const { email } = req.query;


    if (!email) {
      res.status(400).json({
        message: "EMAIL_REQUIRED"
      });
      return;
    }


    // S3 저장 경로
    const key =
      `users/${email}/profile.png`;


    const command =
      new PutObjectCommand({

        Bucket: process.env.S3_PROFILE_BUCKET,

        Key: key,

        ContentType: "image/png"

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

      key

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


    const result =
      await profileService.updateProfile(
        Number(userId),
        nickname,
        profileImage
      );


    res.status(200).json(result);


  } catch(error:any) {

    res.status(400).json({
      message:error.message
    });

  }

}

}

export const profileController = new ProfileController();
