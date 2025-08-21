import { Module } from '@nestjs/common';
import { PrivateClassroomController } from './controller';
import { ClassroomService } from './service';
import { ClassroomRepository } from './repository';

@Module({
  controllers: [PrivateClassroomController],
  providers: [ClassroomService, ClassroomRepository],
})
export class ClassroomModule {}
