import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { StudentController } from './controller/private-student.controller';
import { StudentRepository } from './repository';
import { StudentService } from './service/student.service';

@Module({
  imports: [UploadModule],
  controllers: [StudentController],
  providers: [StudentService, StudentRepository],
})
export class StudentModule {}
