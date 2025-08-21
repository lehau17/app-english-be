import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { RequestContextMiddleware } from '@app/shared/middleware/request-context.middleware';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';
import { AuthModule } from './domains/auth/auth.module';
import { StudentModule } from './domains/student/student.module';
import { CourseModule } from './domains/course/course.module';
import { EventsModule } from './events/events.module';
import { DashboardModule } from './domains/dashboard/dashboard.module';
import { LessonModule } from './domains/lesson';
import { ActivityModule } from './domains/activity';
import { ProgressModule } from './domains/progress';
import { AttemptModule } from './domains/attempt';
import { ParentChildModule } from './domains/parent-child';
import { DeviceTokenModule } from './domains/device-token';
import { NotificationModule } from './domains/notification';
import { TeacherModule } from './domains/teacher';
import { UploadModule } from './domains/upload';

@Module({
    imports: [DatabaseModule, AuthModule, SharedModule, StudentModule, CourseModule, EventsModule, DashboardModule, LessonModule, ActivityModule, ProgressModule, AttemptModule, ParentChildModule, DeviceTokenModule, NotificationModule, TeacherModule, UploadModule],
    controllers: [ClientApiController],
    providers: [ClientApiService],
})
export class ClientApiModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestContextMiddleware).forRoutes('*');
    }
}

