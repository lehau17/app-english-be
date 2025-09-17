import { Module } from '@nestjs/common';
import { PodcastCommentController } from './podcast-comment.controller';
import { PodcastCommentService } from './podcast-comment.service';

@Module({
  controllers: [PodcastCommentController],
  providers: [PodcastCommentService],
  exports: [PodcastCommentService],
})
export class PodcastCommentModule {}
