import { ExcelExportService } from '@app/shared';
import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { PrivateTeacherController } from './controller';
import { TeacherRepository } from './repository';
import { TeacherService } from './service';

@Module({
  imports: [UploadModule],
  controllers: [PrivateTeacherController],
  providers: [TeacherService, TeacherRepository, ExcelExportService],
})
export class TeacherModule {}
