import { Module, forwardRef } from '@nestjs/common';
import { CertificateModule } from '../certificate/certificate.module';
import { ParentModule } from '../parent/parent.module';
import { PrivateLessonController } from './controller';
import { LessonRepository } from './repository';
import { LessonService } from './service';

@Module({
  imports: [ParentModule, forwardRef(() => CertificateModule)],
  controllers: [PrivateLessonController],
  providers: [LessonService, LessonRepository],
})
export class LessonModule {}
