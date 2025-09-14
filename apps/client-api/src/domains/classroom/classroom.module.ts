import { Module } from '@nestjs/common';
import { PrivateClassroomController } from './controller';
import { ClassroomRepository } from './repository';
import { ClassroomService } from './service';

@Module({
  controllers: [PrivateClassroomController],
  providers: [ClassroomService, ClassroomRepository],
})
export class ClassroomModule {}
