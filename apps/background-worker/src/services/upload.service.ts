import { IUploadService } from '@app/shared';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BackgroundWorkerUploadService implements IUploadService {
  private readonly s3Client: S3Client;
  private readonly s3Region: string;
  private readonly s3Endpoint: string;
  private readonly s3AccessKeyId: string;
  private readonly s3SecretAccessKey: string;
  private readonly s3BucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.s3Region = this.configService.getOrThrow<string>('S3_REGION');
    this.s3Endpoint = this.configService.getOrThrow<string>('S3_ENDPOINT');
    this.s3AccessKeyId =
      this.configService.getOrThrow<string>('S3_ACCESS_KEY_ID');
    this.s3SecretAccessKey = this.configService.getOrThrow<string>(
      'S3_SECRET_ACCESS_KEY',
    );
    this.s3BucketName = this.configService.getOrThrow<string>('S3_BUCKET_NAME');

    this.s3Client = new S3Client({
      region: this.s3Region,
      endpoint: this.s3Endpoint,
      credentials: {
        accessKeyId: this.s3AccessKeyId,
        secretAccessKey: this.s3SecretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    contentType: string,
  ): Promise<{ url: string }> {
    const key = `audio/${uuidv4()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: this.s3BucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);

    const url = `${this.s3Endpoint}/${this.s3BucketName}/${key}`;
    return { url };
  }
}
