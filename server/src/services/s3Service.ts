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

}


export const s3Service =
  new S3Service();