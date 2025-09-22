import { Module } from '@nestjs/common';
import { EventsGateway } from '../../events/events.gateway';
import { EventsModule } from '../../events/events.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { PrivateClassroomController } from './controller';
import { ClassroomRepository } from './repository';
import { ClassroomService } from './service';

@Module({
  imports: [AssignmentModule, EventsModule],
  controllers: [PrivateClassroomController],
  providers: [ClassroomService, ClassroomRepository, EventsGateway],
  exports: [ClassroomService, ClassroomRepository],
})
export class ClassroomModule {}
