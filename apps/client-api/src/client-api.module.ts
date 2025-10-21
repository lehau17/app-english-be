import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { RequestContextMiddleware } from '@app/shared/middleware/request-context.middleware';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';
import { ActivityModule } from './domains/activity';
import { AgentModule } from './domains/agent/agent.module';
import { AiSpeakingModule } from './domains/ai-speaking';
import { AssignmentModule } from './domains/assignment';
import { AttemptModule } from './domains/attempt';
import { AuthModule } from './domains/auth/auth.module';
import { CertificateModule } from './domains/certificate/certificate.module';
import { ClassroomModule } from './domains/classroom';
import { ConversationModule } from './domains/conversation';
import { CourseModule } from './domains/course/course.module';
import { DashboardModule } from './domains/dashboard/dashboard.module';
import { DeviceTokenModule } from './domains/device-token';
import { DictionaryModule } from './domains/dictionary/dictionary.module';
import { EvaluationModule } from './domains/evaluation';
import { GoogleTranslateModule } from './domains/google-translate/google-translate.module';
import { LandingPageModule } from './domains/landing-page/landing-page.module';
import { LeaderboardModule } from './domains/leaderboard';
import { LessonModule } from './domains/lesson';
import { NotificationModule } from './domains/notification';
import { ParentModule } from './domains/parent';
import { ParentChildModule } from './domains/parent-child';
import { PaymentModule } from './domains/payment/payment.module';
import { PodcastCommentModule } from './domains/podcast-comment/podcast-comment.module';
import { PodcastRatingModule } from './domains/podcast-rating/podcast-rating.module';
import { PodcastModule } from './domains/podcast/podcast.module';
import { ProgressModule } from './domains/progress';
import { QuizModule } from './domains/quiz/quiz.module';
import { RoomModule } from './domains/room';
import { StudentModule } from './domains/student/student.module';
import { SwaggerLoaderModule } from './domains/swagger/swagger.module';
import { TeacherModule } from './domains/teacher';
import { UploadModule } from './domains/upload';
import { UploadService } from './domains/upload/upload.service';
import { VocabularyModule } from './domains/vocabulary/vocabulary.module';
import { EventsModule } from './events/events.module';

@Module({
    imports: [
        DatabaseModule,
        ScheduleModule.forRoot(),
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
        ConversationModule,
        AssignmentModule,
        GoogleTranslateModule,
        AgentModule,
        SwaggerLoaderModule,
        RoomModule,
        PodcastModule,
        PodcastCommentModule,
        PodcastRatingModule,
        EvaluationModule,
        LeaderboardModule,
        AiSpeakingModule,
        PaymentModule,
        DictionaryModule,
        VocabularyModule,
        QuizModule,
        LandingPageModule,
        CertificateModule,
    ],
    controllers: [ClientApiController],
    providers: [ClientApiService, UploadService],
})
export class ClientApiModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestContextMiddleware).forRoutes('*');
    }
}
