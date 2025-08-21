import { Injectable } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME, s3Config } from './config/s3.config';

@Injectable()
export class UploadService {
  async uploadFile(file: Express.Multer.File): Promise<{ url: string }> {
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileName = `${randomString}-${file.originalname}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    });

    try {
      await s3Client.send(command);
      const url = `${s3Config.endpoint}/${BUCKET_NAME}/${fileName}`;
      return { url };
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error('Failed to upload file.');
    }
  }
}
