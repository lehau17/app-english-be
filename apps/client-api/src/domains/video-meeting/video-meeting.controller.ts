import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  Param,
  Logger,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
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
   * Endpoint called by Jibri finalize script when recording completes
   * Accepts multipart file upload
   * POST /webhooks/recording/complete
   */
  @Post('complete')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Handle recording file upload from Jibri' })
  @ApiResponse({ status: 200, description: 'Recording uploaded successfully' })
  async handleRecordingComplete(
    @UploadedFile() file: Express.Multer.File,
    @Body('roomName') roomName: string,
  ) {
    this.logger.log(
      `Webhook received: ${roomName} - ${file?.originalname || 'no file'} (${file ? (file.size / 1024 / 1024).toFixed(2) + 'MB' : '0MB'})`,
    );

    try {
      await this.videoMeetingService.handleRecordingComplete(file, roomName);
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to process recording webhook:', error);
      return { success: false, error: error.message };
    }
  }
}
