import { RedisCacheService } from '@app/shared/redis/redis-cache.service';
import { Module } from '@nestjs/common';
import { EventsGateway } from '../../events/events.gateway';
import { EventsModule } from '../../events/events.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { LessonRepository } from '../lesson/repository';
import { PaymentModule } from '../payment/payment.module';
import { PrivateClassroomController } from './controller';
import {
    AttendanceController,
    ClassroomAttendanceController,
} from './controller/attendance.controller';
import { ClassroomRepository } from './repository';
import { AttendanceRepository } from './repository/attendance.repository';
import { ClassroomService } from './service';
import { AttendanceService } from './services/attendance.service';
import { AutoExamCreationService } from './services/auto-exam-creation.service';

@Module({
  imports: [AssignmentModule, EventsModule, PaymentModule],
  controllers: [
    PrivateClassroomController,
    AttendanceController,
    ClassroomAttendanceController,
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
  ],
  exports: [ClassroomService, ClassroomRepository, AttendanceService],
})
export class ClassroomModule {}
