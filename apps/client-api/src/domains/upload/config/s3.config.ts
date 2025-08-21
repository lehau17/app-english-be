import { S3Client } from '@aws-sdk/client-s3';

export const s3Config = {
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minio',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minio123',
  },
  forcePathStyle: true, // Required for MinIO
};

export const s3Client = new S3Client(s3Config);
export const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'uploads';
