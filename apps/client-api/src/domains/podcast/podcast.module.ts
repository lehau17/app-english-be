import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from '../upload/upload.service';
import { PlaylistController } from './controller/playlist.controller';
import { PodcastTestController } from './controller/podcast-test.controller';
import { PodcastController } from './controller/private-podcast.controller';
import { PlaylistService } from './service/playlist.service';
import { PodcastService } from './service/podcast.service';
import { TextToPodcastService } from './service/text-to-podcast.service';
import { YouTubeTranscriptService } from './service/youtube-transcript.service';
import { PodcastRepository } from './repository/podcast.repository';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [
    PodcastController,
    PodcastTestController, // New simplified controller
    PlaylistController,
  ],
  providers: [
    PodcastService,
    PlaylistService,
    TextToPodcastService,
    YouTubeTranscriptService,
    UploadService,
    PodcastRepository,
  ],
  exports: [PodcastService, PlaylistService, TextToPodcastService, YouTubeTranscriptService],
})
export class PodcastModule {}
