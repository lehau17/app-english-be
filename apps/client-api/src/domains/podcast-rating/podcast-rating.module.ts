import { Module } from '@nestjs/common';
import { PodcastRatingController } from './podcast-rating.controller';
import { PodcastRatingService } from './podcast-rating.service';

@Module({
  controllers: [PodcastRatingController],
  providers: [PodcastRatingService],
  exports: [PodcastRatingService],
})
export class PodcastRatingModule {}
