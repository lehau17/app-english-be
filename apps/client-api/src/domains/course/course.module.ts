import { Module } from '@nestjs/common';
import { GoogleTranslateModule } from '../google-translate/google-translate.module';
import { GoogleTranslateFreeService } from '../google-translate/google-translate.service';
import { CourseController } from './controller/private-course.controller';
import { CourseRepository } from './repository/course.repository';
import { CourseService } from './service/course.service';
import { CoursesImportService } from './service/course-import.service';
import { UploadService } from '../upload/upload.service';

@Module({
  imports: [GoogleTranslateModule],
  controllers: [CourseController],
  providers: [
    CourseService,
    CourseRepository,
    CoursesImportService,
    GoogleTranslateFreeService,
    UploadService,
  ],
})
export class CourseModule {}
