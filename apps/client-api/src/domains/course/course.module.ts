import { SharedModule, TtsService } from '@app/shared';
import { Module, forwardRef } from '@nestjs/common';
import { CertificateModule } from '../certificate/certificate.module';
import { GoogleTranslateModule } from '../google-translate/google-translate.module';
import { GoogleTranslateFreeService } from '../google-translate/google-translate.service';
import { UploadService } from '../upload/upload.service';
import {
  CourseController,
  PublicCourseController,
  SessionScheduleController,
} from './controller';
import { CourseRepository } from './repository/course.repository';
import { SessionScheduleRepository } from './repository/session-schedule.repository';
import { CourseService } from './service/course.service';
import { CoursesImportService } from './service/couse-import.service';
import { SessionScheduleService } from './service/session-schedule.service';

@Module({
  imports: [
    GoogleTranslateModule,
    SharedModule,
    forwardRef(() => CertificateModule),
  ],
  controllers: [
    CourseController,
    SessionScheduleController,
    PublicCourseController,
  ],
  providers: [
    CourseService,
    CourseRepository,
    CoursesImportService,
    GoogleTranslateFreeService,
    UploadService,
    SessionScheduleService,
    SessionScheduleRepository,
    {
      provide: TtsService,
      useFactory: (uploadService: UploadService) => {
        return new TtsService(uploadService);
      },
      inject: [UploadService],
    },
  ],
})
export class CourseModule {}
