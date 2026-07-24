import { S3Client } from "@aws-sdk/client-s3";


export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

console.log("AWS_REGION =", process.env.AWS_REGION);
console.log("AWS_ACCESS_KEY_ID =", process.env.AWS_ACCESS_KEY_ID);
console.log(
  "AWS_SECRET_ACCESS_KEY =",
  process.env.AWS_SECRET_ACCESS_KEY ? "EXISTS" : "MISSING"
);