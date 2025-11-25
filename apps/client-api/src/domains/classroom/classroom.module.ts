import { Module } from '@nestjs/common';
import { EventsGateway } from '../../events/events.gateway';
import { EventsModule } from '../../events/events.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { LessonRepository } from '../lesson/repository';
import { PaymentModule } from '../payment/payment.module';
import { PrivateClassroomController } from './controller';
import { ClassroomRepository } from './repository';
import { ClassroomService } from './service';
import { AutoExamCreationService } from './services/auto-exam-creation.service';
@Module({
  imports: [AssignmentModule, EventsModule, PaymentModule],
  controllers: [PrivateClassroomController],
  providers: [
    ClassroomService,
    ClassroomRepository,
    EventsGateway,
    LessonRepository,
    AutoExamCreationService,
  ],
  exports: [ClassroomService, ClassroomRepository],
})
export class ClassroomModule {}
