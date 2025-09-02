import { Module } from '@nestjs/common';
import { PrivateTeacherController } from './controller';
import { TeacherService } from './service';
import { TeacherRepository } from './repository';

@Module({
  controllers: [PrivateTeacherController],
  providers: [TeacherService, TeacherRepository],
})
export class TeacherModule {}
