import { Module } from '@nestjs/common';
import { ParentModule } from '../parent/parent.module';
import { PrivateLessonController } from './controller';
import { LessonRepository } from './repository';
import { LessonService } from './service';

@Module({
  imports: [ParentModule],
  controllers: [PrivateLessonController],
  providers: [LessonService, LessonRepository],
})
export class LessonModule {}
