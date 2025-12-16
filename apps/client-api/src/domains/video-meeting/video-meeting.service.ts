import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaRepository } from '@app/database';
import { UploadService } from '../upload/upload.service';

interface MeetingInfo {
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

  constructor(
    private config: ConfigService,
    private prisma: PrismaRepository,
    private uploadService: UploadService,
  ) {
    this.jitsiBaseUrl = this.config.get('videoMeeting.jitsiUrl') || 'http://localhost:8080';
    this.enableRecording = this.config.get('videoMeeting.enableRecording') !== false;
    this.autoRecordStartEnabled = this.config.get('videoMeeting.autoRecordStartEnabled') !== false;
    this.recordingBucket = this.config.get('videoMeeting.recordingBucket') || 'class-recordings';
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

    this.logger.log(`Generated meeting URL for session ${sessionId}: ${roomName}`);

    return {
      meetingUrl,
      roomName,
      recordingPath: `${this.recordingBucket}/${roomName}/`,
    };
  }

  /**
   * Webhook handler - receives file from Jibri, uploads to MinIO, saves URL to session
   */
  async handleRecordingComplete(
    file: Express.Multer.File,
    roomName: string,
  ): Promise<void> {
    this.logger.log(`Recording webhook received for room: ${roomName}`);

    // Validate file
    if (!file) {
      throw new BadRequestException('Recording file is required');
    }

    if (!file.mimetype.startsWith('video/')) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Expected video file.`,
      );
    }

    // Parse sessionId from roomName: class-{classroomId}-session-{sessionId}
    const sessionIdMatch = roomName.match(/session-([a-z0-9-]+)$/i);
    if (!sessionIdMatch) {
      throw new BadRequestException(`Invalid room name format: ${roomName}`);
    }

    const sessionId = sessionIdMatch[1];

    try {
      // Check if session exists
      const session = await this.prisma.classroomSession.findUnique({
        where: { id: sessionId },
        select: { id: true, metadata: true },
      });

      if (!session) {
        this.logger.warn(`Session not found: ${sessionId}`);
        throw new BadRequestException(`Session not found: ${sessionId}`);
      }

      // Upload file to MinIO
      const filename = `recording-${sessionId}-${Date.now()}.mp4`;
      this.logger.log(
        `Uploading recording: ${filename} (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
      );

      const uploadResult = await this.uploadService.uploadBuffer(
        file.buffer,
        filename,
        file.mimetype,
      );

      this.logger.log(`Recording uploaded to MinIO: ${uploadResult.url}`);

      // Update session with recording URL (direct field + metadata)
      const existingMetadata = (session.metadata as Record<string, any>) || {};
      const updatedMetadata = {
        ...existingMetadata,
        recordingFilename: file.originalname || filename,
        recordingUploadedAt: new Date().toISOString(),
        recordingSize: file.size,
      };

      await this.prisma.classroomSession.update({
        where: { id: sessionId },
        data: {
          recordingUrl: uploadResult.url,
          metadata: updatedMetadata,
        },
      });

      this.logger.log(`Recording saved for session ${sessionId}: ${uploadResult.url}`);
    } catch (error) {
      this.logger.error(`Failed to process recording for session ${sessionId}:`, error);
      throw error;
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
      this.logger.error(`Failed to get recording URL for session ${sessionId}:`, error);
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
      this.logger.error(`Failed to get recording metadata for session ${sessionId}:`, error);
      return {
        recordingUrl: null,
        filename: null,
        uploadedAt: null,
        size: null,
      };
    }
  }
}
