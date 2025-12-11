import { PrismaRepository } from '@app/database';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

@Injectable()
export class MediaProcessorService implements OnModuleInit {
  private readonly logger = new Logger(MediaProcessorService.name);
  private tempDir: string;
  private s3Client: S3Client;
  private s3BucketName: string;
  private s3Endpoint: string;

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly configService: ConfigService,
  ) {
    // Initialize S3 client
    const s3Region = this.configService.getOrThrow<string>('S3_REGION');
    this.s3Endpoint = this.configService.getOrThrow<string>('S3_ENDPOINT');
    const s3AccessKeyId =
      this.configService.getOrThrow<string>('S3_ACCESS_KEY_ID');
    const s3SecretAccessKey = this.configService.getOrThrow<string>(
      'S3_SECRET_ACCESS_KEY',
    );
    this.s3BucketName = this.configService.getOrThrow<string>('S3_BUCKET_NAME');

    this.s3Client = new S3Client({
      region: s3Region,
      endpoint: this.s3Endpoint,
      credentials: {
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey,
      },
      forcePathStyle: true,
    });

    // Configure FFmpeg path (try static first, fallback to system)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ffmpegStatic = require('ffmpeg-static');
      if (ffmpegStatic && typeof ffmpegStatic === 'string') {
        ffmpeg.setFfmpegPath(ffmpegStatic);
        this.logger.log('Using ffmpeg-static binary');
      } else if (ffmpegStatic?.default) {
        ffmpeg.setFfmpegPath(ffmpegStatic.default);
        this.logger.log('Using ffmpeg-static binary (default export)');
      }
    } catch (error) {
      this.logger.warn(
        'ffmpeg-static not found, using system FFmpeg (must be installed)',
      );
    }
  }

  async onModuleInit() {
    await this.ensureTempDir();
    await this.checkFFmpegAvailable();
  }

  /**
   * Process video: extract thumbnail and duration
   */
  async processVideo(
    mediaId: string,
    url: string,
    options?: { generateThumbnail?: boolean; extractDuration?: boolean },
  ): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`Processing video ${mediaId} from ${url}`);

    const ext = this.getExtensionFromUrl(url);
    const tempVideoPath = path.join(
      this.tempDir,
      `${mediaId}-${Date.now()}.${ext}`,
    );
    const tempThumbnailPath = path.join(this.tempDir, `${mediaId}-thumb.jpg`);

    try {
      // 1. Download from S3
      this.logger.log(`Step 1/5: Downloading video from S3...`);
      const videoBuffer = await this.downloadFromS3(url);
      await writeFile(tempVideoPath, videoBuffer);
      this.logger.log(`Video downloaded to temp: ${tempVideoPath}`);

      let thumbnailUrl: string | undefined;
      let duration: number | undefined;

      // 2. Extract thumbnail
      if (options?.generateThumbnail !== false) {
        this.logger.log(`Step 2/5: Extracting thumbnail...`);
        await this.extractThumbnail(tempVideoPath, tempThumbnailPath);
        const thumbnailBuffer = await readFile(tempThumbnailPath);
        thumbnailUrl = await this.uploadToS3(
          thumbnailBuffer,
          `${mediaId}-thumb.jpg`,
          'image/jpeg',
        );
        this.logger.log(`Thumbnail uploaded: ${thumbnailUrl}`);
      }

      // 3. Extract duration
      if (options?.extractDuration !== false) {
        this.logger.log(`Step 3/5: Extracting duration...`);
        duration = await this.extractDuration(tempVideoPath);
        this.logger.log(`Duration extracted: ${duration}s`);
      }

      // 4. Update MediaFile
      this.logger.log(`Step 4/5: Updating MediaFile...`);
      await this.prisma.mediaFile.update({
        where: { id: mediaId },
        data: {
          thumbnail: thumbnailUrl,
          duration: duration ? Math.round(duration) : undefined,
          isProcessed: true,
        },
      });

      // 5. Cleanup
      this.logger.log(`Step 5/5: Cleaning up temp files...`);
      await this.cleanupTempFiles(tempVideoPath, tempThumbnailPath);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Video ${mediaId} processed successfully in ${processingTime}ms`,
      );
    } catch (error) {
      // Cleanup on error
      await this.cleanupTempFiles(tempVideoPath, tempThumbnailPath);
      this.logger.error(`Failed to process video ${mediaId}:`, error);
      throw error;
    }
  }

  /**
   * Extract thumbnail from video
   */
  private async extractThumbnail(
    videoPath: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['00:00:01'], // 1 second
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '320x240', // Maintain aspect ratio
        })
        .on('end', () => {
          this.logger.debug(`Thumbnail extracted: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`Failed to extract thumbnail: ${err.message}`);
          reject(err);
        });
    });
  }

  /**
   * Extract duration from video/audio file
   */
  private async extractDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          this.logger.error(`Failed to extract duration: ${err.message}`);
          reject(err);
          return;
        }

        const duration = metadata.format.duration || 0;
        this.logger.debug(`Duration extracted: ${duration}s`);
        resolve(duration);
      });
    });
  }

  /**
   * Process audio: extract duration
   */
  async processAudio(
    mediaId: string,
    url: string,
    options?: { extractDuration?: boolean },
  ): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`Processing audio ${mediaId} from ${url}`);

    const ext = this.getExtensionFromUrl(url);
    const tempAudioPath = path.join(
      this.tempDir,
      `${mediaId}-${Date.now()}.${ext}`,
    );

    try {
      // 1. Download from S3
      this.logger.log(`Step 1/3: Downloading audio from S3...`);
      const audioBuffer = await this.downloadFromS3(url);
      await writeFile(tempAudioPath, audioBuffer);
      this.logger.log(`Audio downloaded to temp: ${tempAudioPath}`);

      let duration: number | undefined;

      // 2. Extract duration
      if (options?.extractDuration !== false) {
        this.logger.log(`Step 2/3: Extracting duration...`);
        duration = await this.extractDuration(tempAudioPath);
        this.logger.log(`Duration extracted: ${duration}s`);
      }

      // 3. Update MediaFile
      this.logger.log(`Step 3/3: Updating MediaFile...`);
      await this.prisma.mediaFile.update({
        where: { id: mediaId },
        data: {
          duration: duration ? Math.round(duration) : undefined,
          isProcessed: true,
        },
      });

      // 4. Cleanup
      await this.cleanupTempFiles(tempAudioPath);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Audio ${mediaId} processed successfully in ${processingTime}ms`,
      );
    } catch (error) {
      // Cleanup on error
      await this.cleanupTempFiles(tempAudioPath);
      this.logger.error(`Failed to process audio ${mediaId}:`, error);
      throw error;
    }
  }

  /**
   * Process image: mark as processed (already processed in UploadService)
   */
  async processImage(mediaId: string, url: string): Promise<void> {
    this.logger.log(`Processing image ${mediaId} from ${url}`);

    try {
      // Images are already processed in UploadService (resize, etc.)
      // Just mark as processed
      await this.prisma.mediaFile.update({
        where: { id: mediaId },
        data: { isProcessed: true },
      });

      this.logger.log(`Image ${mediaId} marked as processed`);
    } catch (error) {
      this.logger.error(`Failed to process image ${mediaId}:`, error);
      throw error;
    }
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDir(): Promise<void> {
    const tempDir =
      this.configService.get<string>('MEDIA_TEMP_DIR') ||
      '/tmp/media-processing';
    try {
      await mkdir(tempDir, { recursive: true });
      this.tempDir = tempDir;
      this.logger.log(`Temp directory ready: ${tempDir}`);
    } catch (error) {
      this.logger.error(`Failed to create temp directory ${tempDir}:`, error);
      throw error;
    }
  }

  /**
   * Download file from S3
   */
  private async downloadFromS3(url: string): Promise<Buffer> {
    try {
      // Parse S3 URL: http://endpoint/bucket/key
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      const bucket = pathParts[0];
      const key = pathParts.slice(1).join('/');

      if (!key) {
        throw new Error(`Invalid S3 URL: ${url}`);
      }

      this.logger.debug(`Downloading from S3: ${bucket}/${key}`);

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error(`Empty response body from S3: ${url}`);
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      this.logger.debug(`Downloaded ${buffer.length} bytes from S3`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to download from S3 ${url}:`, error);
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  /**
   * Upload file to S3
   */
  private async uploadToS3(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    try {
      const key = `media/thumbnails/${uuidv4()}-${filename}`;

      this.logger.debug(`Uploading to S3: ${this.s3BucketName}/${key}`);

      const command = new PutObjectCommand({
        Bucket: this.s3BucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);

      const url = `${this.s3Endpoint}/${this.s3BucketName}/${key}`;
      this.logger.debug(`Uploaded to S3: ${url}`);
      return url;
    } catch (error) {
      this.logger.error(`Failed to upload to S3:`, error);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Cleanup temp files
   */
  private async cleanupTempFiles(...paths: string[]): Promise<void> {
    for (const filePath of paths) {
      try {
        await unlink(filePath);
        this.logger.debug(`Cleaned up temp file: ${filePath}`);
      } catch (error) {
        // File might not exist, ignore error
        this.logger.warn(`Failed to cleanup ${filePath}:`, error);
      }
    }
  }

  /**
   * Check if FFmpeg is available
   */
  private async checkFFmpegAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          this.logger.error('FFmpeg not available:', err);
          resolve(false);
        } else {
          this.logger.log('FFmpeg is available');
          resolve(true);
        }
      });
    });
  }

  /**
   * Get file extension from URL
   */
  private getExtensionFromUrl(url: string): string {
    const match = url.match(/\.(\w+)(\?|$)/);
    return match ? match[1] : 'mp4'; // Default to mp4
  }
}
