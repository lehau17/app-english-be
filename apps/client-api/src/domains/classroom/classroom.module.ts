import { SharedModule, TokenRepository } from '@app/shared';
import { RedisCacheService } from '@app/shared/redis/redis-cache.service';
import { Module } from '@nestjs/common';
import { EventsGateway } from '../../events/events.gateway';
import { EventsModule } from '../../events/events.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { LessonRepository } from '../lesson/repository';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';
import { PrivateClassroomController } from './controller';
import { AttendanceBlockingController } from './controller/attendance-blocking.controller';
import {
  AttendanceController,
  ClassroomAttendanceController,
} from './controller/attendance.controller';
import {
  MakeupRequestAdminController,
  MakeupRequestStudentController,
} from './controller/makeup-request.controller';
import {
  RescheduleRequestAdminController,
  RescheduleRequestTeacherController,
} from './controller/reschedule-request.controller';
import { ClassroomRepository } from './repository';
import { AttendanceRepository } from './repository/attendance.repository';
import { MakeupRequestRepository } from './repository/makeup-request.repository';
import { RescheduleRequestRepository } from './repository/reschedule-request.repository';
import { ClassroomService } from './service';
import { AttendanceBlockingService } from './service/attendance-blocking.service';
import { AttendanceService } from './services/attendance.service';
import { AutoExamCreationService } from './services/auto-exam-creation.service';
import { MakeupRequestService } from './services/makeup-request.service';
import { RescheduleRequestService } from './services/reschedule-request.service';

@Module({
  imports: [
    AssignmentModule,
    EventsModule,
    PaymentModule,
    NotificationModule,
    SharedModule,
  ],
  controllers: [
    PrivateClassroomController,
    AttendanceController,
    ClassroomAttendanceController,
    AttendanceBlockingController,
    // Makeup Request
    MakeupRequestStudentController,
    MakeupRequestAdminController,
    // Reschedule Request
    RescheduleRequestTeacherController,
    RescheduleRequestAdminController,
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
    AttendanceBlockingService,
    TokenRepository,
    RedisCacheService,
    // Makeup Request
    MakeupRequestService,
    MakeupRequestRepository,
    // Reschedule Request
    RescheduleRequestService,
    RescheduleRequestRepository,
  ],
  exports: [
    ClassroomService,
    ClassroomRepository,
    AttendanceService,
    AttendanceBlockingService,
    MakeupRequestService,
    RescheduleRequestService,
  ],
})
export class ClassroomModule {}
