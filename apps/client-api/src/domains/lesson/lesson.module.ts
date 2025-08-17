import { Module } from '@nestjs/common';
import { PrivateLessonController } from './controller';
import { LessonService } from './service';
import { LessonRepository } from './repository';

@Module({
  controllers: [PrivateLessonController],
  providers: [LessonService, LessonRepository],
})
export class LessonModule {}
