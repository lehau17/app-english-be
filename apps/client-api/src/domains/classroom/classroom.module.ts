import { RedisCacheService } from '@app/shared/redis/redis-cache.service';
import { Module } from '@nestjs/common';
import { EventsGateway } from '../../events/events.gateway';
import { EventsModule } from '../../events/events.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { LessonRepository } from '../lesson/repository';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';
import { PrivateClassroomController } from './controller';
import {
  AttendanceController,
  ClassroomAttendanceController,
} from './controller/attendance.controller';
import {
  MakeupRequestStudentController,
  MakeupRequestAdminController,
} from './controller/makeup-request.controller';
import { ClassroomRepository } from './repository';
import { AttendanceRepository } from './repository/attendance.repository';
import { MakeupRequestRepository } from './repository/makeup-request.repository';
import { ClassroomService } from './service';
import { AttendanceService } from './services/attendance.service';
import { MakeupRequestService } from './services/makeup-request.service';
import { AutoExamCreationService } from './services/auto-exam-creation.service';

@Module({
  imports: [AssignmentModule, EventsModule, PaymentModule, NotificationModule],
  controllers: [
    PrivateClassroomController,
    AttendanceController,
    ClassroomAttendanceController,
    // Makeup Request
    MakeupRequestStudentController,
    MakeupRequestAdminController,
  ],
  providers: [
    ClassroomService,
    ClassroomRepository,
    EventsGateway,
    LessonRepository,
    AutoExamCreationService,
    // Attendance
    AttendanceService,
    AttendanceRepository,
    RedisCacheService,
    // Makeup Request
    MakeupRequestService,
    MakeupRequestRepository,
  ],
  exports: [ClassroomService, ClassroomRepository, AttendanceService, MakeupRequestService],
})
export class ClassroomModule { }

