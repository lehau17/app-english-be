import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { PrivateConversationController } from './controller';
import { ConversationRepository } from './repository';
import { ConversationService } from './service';

@Module({
  imports: [EventsModule],
  controllers: [PrivateConversationController],
  providers: [ConversationService, ConversationRepository],
  exports: [ConversationService, ConversationRepository],
})
export class ConversationModule {}
