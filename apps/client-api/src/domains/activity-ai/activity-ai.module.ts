import { Module } from '@nestjs/common';
import { GoogleTranslateModule } from '../google-translate/google-translate.module';
import { UploadModule } from '../upload/upload.module';
import { ActivityAIController } from './controller/activity-ai.controller';
import { ActivityAIService } from './service/activity-ai.service';
import { SharedModule } from '@app/shared';

@Module({
  imports: [SharedModule, GoogleTranslateModule, UploadModule],
  controllers: [ActivityAIController],
  providers: [ActivityAIService],
  exports: [ActivityAIService],
})
export class ActivityAIModule {}
