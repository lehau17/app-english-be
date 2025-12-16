import { Controller, Post, Body, HttpCode, Get, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VideoMeetingService } from './video-meeting.service';

@ApiTags('Video Meeting')
@Controller('video-meeting')
export class VideoMeetingController {
  private readonly logger = new Logger(VideoMeetingController.name);

  constructor(private videoMeetingService: VideoMeetingService) {}

  /**
   * Generate meeting URL for a classroom session
   * GET /video-meeting/session/:sessionId/url
   */
  @Get('session/:sessionId/url')
  @ApiOperation({ summary: 'Generate Jitsi meeting URL for session' })
  @ApiResponse({ status: 200, description: 'Meeting URL generated successfully' })
  async generateMeetingUrl(
    @Param('sessionId') sessionId: string,
  ) {
    // In real implementation, fetch session to get classroomId
    // For now, using sessionId as placeholder
    const classroomId = 'placeholder'; // TODO: fetch from session

    const meetingInfo = this.videoMeetingService.generateMeetingUrl(classroomId, sessionId);

    return {
      success: true,
      data: meetingInfo,
    };
  }

  /**
   * Get recording URL for a session
   * GET /video-meeting/session/:sessionId/recording
   */
  @Get('session/:sessionId/recording')
  @ApiOperation({ summary: 'Get recording URL for session' })
  @ApiResponse({ status: 200, description: 'Recording metadata retrieved' })
  async getRecording(
    @Param('sessionId') sessionId: string,
  ) {
    const metadata = await this.videoMeetingService.getRecordingMetadata(sessionId);

    return {
      success: true,
      data: metadata,
    };
  }
}

@ApiTags('Webhooks')
@Controller('webhooks/recording')
export class RecordingWebhookController {
  private readonly logger = new Logger(RecordingWebhookController.name);

  constructor(private videoMeetingService: VideoMeetingService) {}

  /**
   * Endpoint called by recording-uploader when upload completes
   * POST /webhooks/recording/complete
   */
  @Post('complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle recording upload completion webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleRecordingComplete(
    @Body() payload: {
      roomName: string;
      recordingUrl: string;
      filename: string;
      uploadedAt: string;
    }
  ) {
    this.logger.log(`Webhook received: ${payload.roomName} - ${payload.filename}`);

    try {
      await this.videoMeetingService.handleRecordingComplete(payload);
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to process webhook:', error);
      // Return success to avoid webhook retries
      return { success: false, error: error.message };
    }
  }
}
