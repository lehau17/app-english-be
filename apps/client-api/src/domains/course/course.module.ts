import { SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { GoogleTranslateModule } from '../google-translate/google-translate.module';
import { GoogleTranslateFreeService } from '../google-translate/google-translate.service';
import { UploadService } from '../upload/upload.service';
import { CourseController, SessionScheduleController } from './controller';
import { CourseRepository } from './repository/course.repository';
import { SessionScheduleRepository } from './repository/session-schedule.repository';
import { CourseService } from './service/course.service';
import { CoursesImportService } from './service/couse-import.service';
import { SessionScheduleService } from './service/session-schedule.service';

@Module({
  imports: [GoogleTranslateModule, SharedModule],
  controllers: [CourseController, SessionScheduleController],
  providers: [
    CourseService,
    CourseRepository,
    CoursesImportService,
    GoogleTranslateFreeService,
    UploadService,
    SessionScheduleService,
    SessionScheduleRepository,
  ],
})
export class CourseModule {}
