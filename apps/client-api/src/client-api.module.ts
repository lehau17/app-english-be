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

@Module({
    imports: [DatabaseModule, AuthModule, SharedModule, StudentModule, CourseModule, EventsModule, DashboardModule, LessonModule],
    controllers: [ClientApiController],
    providers: [ClientApiService],
})
export class ClientApiModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestContextMiddleware).forRoutes('*');
    }
}

