import {
  PutObjectCommand
} from "@aws-sdk/client-s3";

import {
  getSignedUrl
} from "@aws-sdk/s3-request-presigner";

import { s3Client } from "../config/s3";


export class S3Service {


  async createProfileUploadUrl(email: string) {


    const key =
      `profile/${email}/profile.png`;


    const command =
      new PutObjectCommand({

        Bucket:
          process.env.AWS_S3_PROFILE_BUCKET,

        Key: key,

        ContentType:
          "image/*",

      });


    const uploadUrl =
      await getSignedUrl(
        s3Client,
        command,
        {
          expiresIn: 300
        }
      );


    return {
      uploadUrl,
      key
    };

  }

  // 주어진 S3 객체 키를 presigned GET URL로 변환합니다.
  // key가 null/empty이면 null을 반환합니다.
  // 이미 http(s)로 시작하면 그대로 반환합니다.
  async getProfilePresignedGetUrl(key?: string | null): Promise<string | null> {
    try {
      if (!key) return null;
      if (typeof key === 'string' && (key.startsWith('http://') || key.startsWith('https://'))) {
        return key;
      }

      // key가 유효한 경우 presign 생성
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const command = new GetObjectCommand({
        Bucket: process.env.S3_PROFILE_BUCKET,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return url;
    } catch (err) {
      // 오류 발생 시 null 반환 (로그에 URL 또는 자격증명 출력 금지)
      console.warn('S3 presign 실패:', (err as any)?.message || err);
      return null;
    }
  }

}


export const s3Service =
  new S3Service();