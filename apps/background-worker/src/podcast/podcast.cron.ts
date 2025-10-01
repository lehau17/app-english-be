import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PodcastGenerationService } from './podcast-generation.service';

@Injectable()
export class PodcastCron {
  constructor(
    private readonly podcastGenerationService: PodcastGenerationService,
  ) {}

  @Cron('0 0 * * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailyPodcastGeneration(): Promise<void> {
    await this.podcastGenerationService.generateDailyPodcasts();
  }
}
