import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaRepository } from '@app/database';

interface MeetingInfo {
  meetingUrl: string;
  roomName: string;
  recordingPath: string;
}

interface RecordingWebhookPayload {
  roomName: string;
  recordingUrl: string;
  filename: string;
  uploadedAt: string;
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
   * Webhook handler - called when recording upload completes
   */
  async handleRecordingComplete(payload: RecordingWebhookPayload): Promise<void> {
    const { roomName, recordingUrl, filename, uploadedAt } = payload;

    this.logger.log(`Recording complete webhook received for room: ${roomName}`);

    // Parse sessionId from roomName: class-{classroomId}-session-{sessionId}
    const sessionIdMatch = roomName.match(/session-([a-z0-9-]+)$/i);
    if (!sessionIdMatch) {
      this.logger.warn(`Invalid room name format: ${roomName}`);
      return;
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
        return;
      }

      // Merge with existing metadata
      const existingMetadata = (session.metadata as Record<string, any>) || {};
      const updatedMetadata = {
        ...existingMetadata,
        recordingUrl,
        recordingFilename: filename,
        recordingUploadedAt: uploadedAt,
        recordingBucket: this.recordingBucket,
      };

      // Update session with recording URL
      await this.prisma.classroomSession.update({
        where: { id: sessionId },
        data: {
          metadata: updatedMetadata,
        },
      });

      this.logger.log(`Recording saved for session ${sessionId}: ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to save recording for session ${sessionId}:`, error);
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
        select: { metadata: true },
      });

      if (!session?.metadata) {
        return null;
      }

      const metadata = session.metadata as Record<string, any>;
      return metadata?.recordingUrl || null;
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
  }> {
    try {
      const session = await this.prisma.classroomSession.findUnique({
        where: { id: sessionId },
        select: { metadata: true },
      });

      if (!session?.metadata) {
        return {
          recordingUrl: null,
          filename: null,
          uploadedAt: null,
        };
      }

      const metadata = session.metadata as Record<string, any>;
      return {
        recordingUrl: metadata?.recordingUrl || null,
        filename: metadata?.recordingFilename || null,
        uploadedAt: metadata?.recordingUploadedAt || null,
      };
    } catch (error) {
      this.logger.error(`Failed to get recording metadata for session ${sessionId}:`, error);
      return {
        recordingUrl: null,
        filename: null,
        uploadedAt: null,
      };
    }
  }
}
