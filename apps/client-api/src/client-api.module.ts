import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { RequestContextMiddleware } from '@app/shared/middleware/request-context.middleware';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';
import { ActivityModule } from './domains/activity';
import { AttemptModule } from './domains/attempt';
import { AuthModule } from './domains/auth/auth.module';
import { ClassroomModule } from './domains/classroom';
import { CourseModule } from './domains/course/course.module';
import { DashboardModule } from './domains/dashboard/dashboard.module';
import { DeviceTokenModule } from './domains/device-token';
import { GoogleTranslateModule } from './domains/google-translate/google-translate.module';
import { LessonModule } from './domains/lesson';
import { NotificationModule } from './domains/notification';
import { ParentModule } from './domains/parent';
import { ParentChildModule } from './domains/parent-child';
import { ProgressModule } from './domains/progress';
import { RoomModule } from './domains/room';
import { StudentModule } from './domains/student/student.module';
import { SwaggerLoaderModule } from './domains/swagger/swagger.module';
import { TeacherModule } from './domains/teacher';
import { UploadModule } from './domains/upload';
import { EventsModule } from './events/events.module';
import { AgentModule } from './domains/agent/agent.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    SharedModule,
    StudentModule,
    CourseModule,
    EventsModule,
    DashboardModule,
    LessonModule,
    ActivityModule,
    ProgressModule,
    AttemptModule,
    ParentChildModule,
    ParentModule,
    DeviceTokenModule,
    NotificationModule,
    TeacherModule,
    UploadModule,
    ClassroomModule,
    GoogleTranslateModule,
    AgentModule,
    SwaggerLoaderModule,
    RoomModule,
  ],
  controllers: [ClientApiController],
  providers: [ClientApiService],
})
export class ClientApiModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
