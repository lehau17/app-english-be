import { ListBucketsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
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

    // Log S3 config on startup (without sensitive data)
    this.logger.log(`S3 Configuration initialized:`);
    this.logger.log(`  - Endpoint: ${this.s3Endpoint}`);
    this.logger.log(`  - Bucket: ${this.s3BucketName}`);
    this.logger.log(`  - Region: ${this.s3Region}`);
    this.logger.log(`  - Access Key: ${this.s3AccessKeyId.substring(0, 5)}***`);
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      let processedBuffer = file.buffer;
      let contentType = file.mimetype;
      let originalname = file.originalname;

      this.logger.log(`Uploading file: ${originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      // Check if the file is an image
      if (file.mimetype.startsWith('image/')) {
        processedBuffer = await sharp(file.buffer)
          .resize(800, undefined, {
            fit: sharp.fit.inside,
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer();
        contentType = 'image/jpeg';
        originalname = originalname.replace(/\.[^/.]+$/, '') + '.jpeg'; // Change extension to .jpeg
      }

      const key = `${uuidv4()}-${originalname}`;

      const command = new PutObjectCommand({
        Bucket: this.s3BucketName,
        Key: key,
        Body: processedBuffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      const url = `${this.s3Endpoint}/${this.s3BucketName}/${key}`;
      this.logger.log(`Upload successful: ${url}`);
      return url;
    } catch (error) {
      this.logger.error('S3 Upload Error:', {
        message: error.message,
        code: error.code,
        name: error.name,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        endpoint: this.s3Endpoint,
        bucket: this.s3BucketName,
        file: file.originalname,
      });

      // Log raw response if available
      if (error.$response) {
        this.logger.error('Raw S3 Response:', {
          statusCode: error.$response.statusCode,
          headers: error.$response.headers,
          body: error.$response.body?.toString()?.substring(0, 500), // First 500 chars
        });
      }

      throw new Error(
        `Failed to upload to S3 (${this.s3Endpoint}): ${error.message}. ` +
        `Check if MinIO/S3 is accessible and credentials are correct.`
      );
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    contentType: string,
  ): Promise<{ url: string }> {
    try {
      const key = `${uuidv4()}-${filename}`;

      this.logger.log(`Uploading buffer: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);

      const command = new PutObjectCommand({
        Bucket: this.s3BucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      const url = `${this.s3Endpoint}/${this.s3BucketName}/${key}`;
      this.logger.log(`Buffer upload successful: ${url}`);
      return { url };
    } catch (error) {
      this.logger.error('S3 Upload Buffer Error:', {
        message: error.message,
        code: error.code,
        name: error.name,
        statusCode: error.$metadata?.httpStatusCode,
        endpoint: this.s3Endpoint,
        bucket: this.s3BucketName,
        filename,
      });

      if (error.$response) {
        this.logger.error('Raw S3 Response:', {
          statusCode: error.$response.statusCode,
          headers: error.$response.headers,
          body: error.$response.body?.toString()?.substring(0, 500),
        });
      }

      throw new Error(
        `Failed to upload buffer to S3 (${this.s3Endpoint}): ${error.message}`
      );
    }
  }

  /**
   * Test S3 connection
   */
  async testConnection(): Promise<{
    success: boolean;
    endpoint: string;
    bucket: string;
    region: string;
    message: string;
    error?: any;
    buckets?: string[];
  }> {
    try {
      this.logger.log('Testing S3 connection...');

      const command = new ListBucketsCommand({});
      const response = await this.s3Client.send(command);

      const bucketNames = response.Buckets?.map(b => b.Name) || [];
      const bucketExists = bucketNames.includes(this.s3BucketName);

      this.logger.log(`S3 connection successful. Found ${bucketNames.length} buckets.`);

      return {
        success: true,
        endpoint: this.s3Endpoint,
        bucket: this.s3BucketName,
        region: this.s3Region,
        message: bucketExists
          ? `S3 connection OK. Bucket '${this.s3BucketName}' exists.`
          : `S3 connection OK but bucket '${this.s3BucketName}' NOT FOUND!`,
        buckets: bucketNames,
      };
    } catch (error) {
      this.logger.error('S3 connection test failed:', {
        message: error.message,
        code: error.code,
        name: error.name,
        endpoint: this.s3Endpoint,
      });

      if (error.$response) {
        this.logger.error('Raw response:', {
          statusCode: error.$response.statusCode,
          body: error.$response.body?.toString()?.substring(0, 500),
        });
      }

      return {
        success: false,
        endpoint: this.s3Endpoint,
        bucket: this.s3BucketName,
        region: this.s3Region,
        message: `S3 connection FAILED: ${error.message}`,
        error: {
          message: error.message,
          code: error.code,
          name: error.name,
          statusCode: error.$metadata?.httpStatusCode,
        },
      };
    }
  }
}
