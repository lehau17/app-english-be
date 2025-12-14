import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { RequestContextMiddleware } from '@app/shared/middleware/request-context.middleware';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';
import { ActivityModule } from './domains/activity';
import { ActivityAIModule } from './domains/activity-ai/activity-ai.module';
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
import { GradebookModule } from './domains/gradebook';
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
import { VocabularyV2Module } from './domains/vocabulary-v2/vocabulary-v2.module';
import { VocabularyModule } from './domains/vocabulary/vocabulary.module';
import { MediaModule } from './domains/media/media.module';
import { EventsModule } from './events/events.module';
import { LearningPathModule } from './domains/learning-path/learning-path.module';
import { RecommendationModule } from './domains/recommendation/recommendation.module';
import { TopicsModule } from './domains/topics/topics.module';

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
    ActivityAIModule,
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
    GradebookModule,
    LeaderboardModule,
    AiSpeakingModule,
    PaymentModule,
    DictionaryModule,
    VocabularyModule,
    VocabularyV2Module,
    MediaModule,
    QuizModule,
    LandingPageModule,
    CertificateModule,
    LearningPathModule,
    RecommendationModule,
    TopicsModule,
  ],
  controllers: [ClientApiController],
  providers: [ClientApiService, UploadService],
})
export class ClientApiModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
