import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlaylistController } from './controller/playlist.controller';
import { PodcastActivityController } from './controller/podcast-activity.controller';
import { PodcastController } from './controller/private-podcast.controller';
import { PlaylistService } from './service/playlist.service';
import { PodcastActivityService } from './service/podcast-activity.service';
import { PodcastService } from './service/podcast.service';
import { TextToPodcastService } from './service/text-to-podcast.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [
    PodcastController,
    PodcastActivityController,
    PlaylistController,
  ],
  providers: [
    PodcastService,
    PodcastActivityService,
    PlaylistService,
    TextToPodcastService,
  ],
  exports: [
    PodcastService,
    PodcastActivityService,
    PlaylistService,
    TextToPodcastService,
  ],
})
export class PodcastModule {}
