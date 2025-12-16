import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/database';
import { VideoMeetingService } from './video-meeting.service';
import { VideoMeetingController, RecordingWebhookController } from './video-meeting.controller';
import videoMeetingConfig from '../../config/video-meeting.config';

@Module({
  imports: [
    ConfigModule.forFeature(videoMeetingConfig),
    DatabaseModule,
  ],
  controllers: [VideoMeetingController, RecordingWebhookController],
  providers: [VideoMeetingService],
  exports: [VideoMeetingService],
})
export class VideoMeetingModule {}
