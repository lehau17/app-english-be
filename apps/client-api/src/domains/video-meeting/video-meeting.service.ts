import { PrismaRepository } from '@app/database';
import {
  BadRequestException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'path';
import { UploadService } from '../upload/upload.service';

export interface MeetingInfo {
  meetingUrl: string;
  roomName: string;
  recordingPath: string;
}

@Injectable()
export class VideoMeetingService {
  private readonly logger = new Logger(VideoMeetingService.name);
  private readonly jitsiBaseUrl: string;
  private readonly enableRecording: boolean;
  private readonly autoRecordStartEnabled: boolean;
  private readonly recordingBucket: string;

  // Locking mechanism: Set of sessionIds currently being processed
  private readonly processingSessions = new Set<string>();

  constructor(
    private config: ConfigService,
    private prisma: PrismaRepository,
    private uploadService: UploadService,
  ) {
    this.jitsiBaseUrl =
      this.config.get('videoMeeting.jitsiUrl') || 'http://localhost:8080';
    this.enableRecording =
      this.config.get('videoMeeting.enableRecording') !== false;
    this.autoRecordStartEnabled =
      this.config.get('videoMeeting.autoRecordStartEnabled') !== false;
    this.recordingBucket =
      this.config.get('videoMeeting.recordingBucket') || 'class-recordings';
  }

  /**
   * Generate meeting URL with auto-record enabled
   * Room naming convention: class-{classroomId}-session-{sessionId}
   */
  generateMeetingUrl(classroomId: string, sessionId: string): MeetingInfo {
    // Room name format important for Jibri auto-record
    const roomName = `class-${classroomId}-session-${sessionId}`;

    // Config options for auto-recording
    const configParams = new URLSearchParams({
      'config.startWithVideoMuted': 'false',
      'config.startWithAudioMuted': 'false',
      'config.prejoinPageEnabled': 'false',
      // AUTO RECORD: Start recording when moderator joins
      'config.fileRecordingsEnabled': this.enableRecording.toString(),
      'config.liveStreamingEnabled': 'false',
      'config.autoRecordStartEnabled': this.autoRecordStartEnabled.toString(),
    });

    const meetingUrl = `${this.jitsiBaseUrl}/${roomName}?${configParams.toString()}`;

    this.logger.log(
      `Generated meeting URL for session ${sessionId}: ${roomName}`,
    );

    return {
      meetingUrl,
      roomName,
      recordingPath: `${this.recordingBucket}/${roomName}/`,
    };
  }

  /**
   * Webhook handler - receives file from Jibri, uploads to MinIO, saves URL to session
   * Implements locking (wait max 10s) and video merging if multiple parts arrive.
   */
  async handleRecordingComplete(
    file: Express.Multer.File,
    roomName: string,
  ): Promise<void> {
    this.logger.log(`Recording webhook received for room: ${roomName}`);

    if (!file) throw new BadRequestException('Recording file is required');

    const original = (file.originalname || '').toLowerCase();
    const ext = extname(original);

    const allowedExt = new Set(['.mp4', '.webm', '.mkv', '.mov']);
    const isVideoMime = !!file.mimetype && file.mimetype.startsWith('video/');
    const isOctet = file.mimetype === 'application/octet-stream';

    // ✅ Accept if:
    // - real video mimetype
    // - OR octet-stream but has a known video extension
    if (!(isVideoMime || (isOctet && allowedExt.has(ext)))) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. name=${file.originalname}`,
      );
    }

    // Parse sessionId from roomName: class-{classroomId}-session-{sessionId}
    // roomName = roomName.split(" - ")[1]
    const sessionIdMatch = roomName.match(/session-([a-z0-9-]+)(?:[_\.].*)?$/i);
    if (!sessionIdMatch) {
      throw new BadRequestException(`Invalid room name format: ${roomName}`);
    }

    const sessionId = sessionIdMatch[1];
    const lockTimeout = 10000; // 10 seconds
    const retryInterval = 100; // 100 ms

    // === LOCKING MECHANISM ===
    const startTime = Date.now();
    while (this.processingSessions.has(sessionId)) {
      if (Date.now() - startTime > lockTimeout) {
        this.logger.error(`Timeout waiting for lock on session ${sessionId}`);
        throw new RequestTimeoutException(
          `System busy processing another recording for this session. Please try again later.`,
        );
      }
      // Wait 100ms
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }

    // Acquire lock
    this.processingSessions.add(sessionId);

    try {
      // Check if session exists
      const session = await this.prisma.classroomSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          metadata: true,
          recordingUrl: true,
        },
      });

      if (!session) {
        this.logger.warn(`Session not found: ${sessionId}`);
        throw new BadRequestException(`Session not found: ${sessionId}`);
      }

      const existingRecordingUrl = session.recordingUrl;
      let bufferToUpload = file.buffer;
      let finalFilename = `recording-${sessionId}-${Date.now()}.mp4`;

      // If there is an existing recording, MERGE IT
      if (existingRecordingUrl && existingRecordingUrl.startsWith('http')) {
        this.logger.log(
          `Existing recording found for session ${sessionId}. Merging...`,
        );
        try {
          const mergedResult = await this.mergeWithExistingVideo(
            sessionId,
            existingRecordingUrl,
            file.buffer,
            ext || '.mp4',
          );
          bufferToUpload = mergedResult.buffer;
          this.logger.log(
            `Merge successful. New size: ${(
              bufferToUpload.length /
              1024 /
              1024
            ).toFixed(2)}MB`,
          );
          // finalFilename = `merged-${sessionId}-${Date.now()}.mp4`;
        } catch (mergeError) {
          this.logger.error(
            `Failed to merge videos for session ${sessionId}. Falling back to standard upload (overwrite).`,
            mergeError,
          );
          // Fallback handled by just skipping the buffer update
        }
      }

      // Upload file to MinIO
      this.logger.log(
        `Uploading recording: ${finalFilename} (${(
          bufferToUpload.length /
          1024 /
          1024
        ).toFixed(2)}MB)`,
      );

      const uploadResult = await this.uploadService.uploadBuffer(
        bufferToUpload,
        finalFilename,
        file.mimetype || 'video/mp4',
      );

      this.logger.log(`Recording uploaded to MinIO: ${uploadResult.url}`);

      // Update session with recording URL (direct field + metadata)
      const existingMetadata = (session.metadata as Record<string, any>) || {};
      const updatedMetadata = {
        ...existingMetadata,
        recordingFilename: file.originalname || finalFilename,
        recordingUploadedAt: new Date().toISOString(),
        recordingSize: bufferToUpload.length,
        recordingMerged: !!existingRecordingUrl,
      };

      await this.prisma.classroomSession.update({
        where: { id: sessionId },
        data: {
          recordingUrl: uploadResult.url,
          metadata: updatedMetadata,
        },
      });

      this.logger.log(
        `Recording saved for session ${sessionId}: ${uploadResult.url}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process recording for session ${sessionId}:`,
        error,
      );
      throw error;
    } finally {
      // Release lock
      this.processingSessions.delete(sessionId);
    }
  }

  /**
   * Helper: Download existing video, save new buffer to temp, merge using ffmpeg, return Buffer
   */
  private async mergeWithExistingVideo(
    sessionId: string,
    existingUrl: string,
    newBuffer: Buffer,
    ext: string,
  ): Promise<{ buffer: Buffer }> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const axios = require('axios');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpeg = require('fluent-ffmpeg');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegPath = require('ffmpeg-static');

    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }

    const tempDir = path.join(process.cwd(), 'temp-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const file1Path = path.join(tempDir, `${sessionId}-part1${ext}`);
    const file2Path = path.join(tempDir, `${sessionId}-part2${ext}`);
    const outputPath = path.join(
      tempDir,
      `${sessionId}-merged-${Date.now()}${ext}`,
    );

    try {
      // 1. Download existing video
      this.logger.log(`Downloading existing video from ${existingUrl}...`);
      const response = await axios.get(existingUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      fs.writeFileSync(file1Path, response.data);

      // 2. Save new video buffer
      fs.writeFileSync(file2Path, newBuffer);

      // 3. Merge
      this.logger.log(`Merging videos with ffmpeg...`);
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(file1Path)
          .input(file2Path)
          .on('error', (err) => {
            this.logger.error('Ffmpeg error:', err);
            reject(err);
          })
          .on('end', () => {
            this.logger.log('Ffmpeg merge finished successfully');
            resolve();
          })
          .mergeToFile(outputPath, tempDir);
      });

      // 4. Read merged file back to buffer
      if (!fs.existsSync(outputPath)) {
        throw new Error('Merged file not found at ' + outputPath);
      }
      const mergedBuffer = fs.readFileSync(outputPath);

      // 5. Cleanup temp files
      try {
        if (fs.existsSync(file1Path)) fs.unlinkSync(file1Path);
        if (fs.existsSync(file2Path)) fs.unlinkSync(file2Path);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (cleanupErr) {
        this.logger.warn('Failed to cleanup temp files', cleanupErr);
      }

      return { buffer: mergedBuffer };
    } catch (err) {
      this.logger.error('Merge helper failed', err);
      // Try cleanup even on error
      try {
        if (fs.existsSync(file1Path)) fs.unlinkSync(file1Path);
        if (fs.existsSync(file2Path)) fs.unlinkSync(file2Path);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (e) {
        /* ignore */
      }
      throw err;
    }
  }

  /**
   * Get recording URL for a session
   */
  async getRecordingUrl(sessionId: string): Promise<string | null> {
    try {
      const session = await this.prisma.classroomSession.findUnique({
        where: { id: sessionId },
        select: { recordingUrl: true },
      });

      return session?.recordingUrl || null;
    } catch (error) {
      this.logger.error(
        `Failed to get recording URL for session ${sessionId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get recording metadata for a session
   */
  async getRecordingMetadata(sessionId: string): Promise<{
    recordingUrl: string | null;
    filename: string | null;
    uploadedAt: string | null;
    size: number | null;
  }> {
    try {
      const session = await this.prisma.classroomSession.findUnique({
        where: { id: sessionId },
        select: { recordingUrl: true, metadata: true },
      });

      if (!session?.recordingUrl) {
        return {
          recordingUrl: null,
          filename: null,
          uploadedAt: null,
          size: null,
        };
      }

      const metadata = (session.metadata as Record<string, any>) || {};
      return {
        recordingUrl: session.recordingUrl,
        filename: metadata?.recordingFilename || null,
        uploadedAt: metadata?.recordingUploadedAt || null,
        size: metadata?.recordingSize || null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get recording metadata for session ${sessionId}:`,
        error,
      );
      return {
        recordingUrl: null,
        filename: null,
        uploadedAt: null,
        size: null,
      };
    }
  }
}
