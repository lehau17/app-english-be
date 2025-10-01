import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from '../upload/upload.service';
import { AiSpeakingHealthController } from './controller/ai-speaking-health.controller';
import { AiSpeakingController } from './controller/ai-speaking.controller';
import { AiSpeakingGateway } from './gateway/ai-speaking.gateway';
import { AiSpeakingRepository } from './repository/ai-speaking.repository';
import { AiSpeakingCoordinator } from './service/ai-speaking-coordinator.service';
import { AiSpeakingHealthService } from './service/ai-speaking-health.service';
import { AiSpeakingRealtimeService } from './service/ai-speaking-realtime.service';
import { AiSpeakingTurnManager } from './service/ai-speaking-turn-manager.service';
import { AiSpeakingService } from './service/ai-speaking.service';
import { ConversationDesignerService } from './service/conversation-designer.service';
import { RealtimeAsrService } from './service/realtime-asr.service';
import { RealtimeTtsService } from './service/realtime-tts.service';

@Module({
  imports: [DatabaseModule, SharedModule, ConfigModule],
  controllers: [AiSpeakingController, AiSpeakingHealthController],
  providers: [
    AiSpeakingService,
    AiSpeakingCoordinator,
    ConversationDesignerService,
    AiSpeakingRealtimeService,
    AiSpeakingTurnManager,
    AiSpeakingHealthService,
    RealtimeTtsService,
    RealtimeAsrService,
    AiSpeakingRepository,
    AiSpeakingGateway,
    UploadService,
  ],
  exports: [AiSpeakingService],
})
export class AiSpeakingModule {}
