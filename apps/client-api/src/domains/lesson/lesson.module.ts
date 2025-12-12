import { Module, forwardRef } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { CertificateModule } from '../certificate/certificate.module';
import { ClassroomModule } from '../classroom/classroom.module';
import { LearningPathModule } from '../learning-path/learning-path.module';
import { ParentModule } from '../parent/parent.module';
import { PrivateLessonController } from './controller';
import { LessonRepository } from './repository';
import { LessonService } from './service';

@Module({
  imports: [
    ParentModule,
    forwardRef(() => CertificateModule),
    forwardRef(() => ClassroomModule),
    LearningPathModule,
    AgentModule,
  ],
  controllers: [PrivateLessonController],
  providers: [LessonService, LessonRepository],
})
export class LessonModule {}
