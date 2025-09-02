import { Global, Module } from '@nestjs/common';
import { TokenRepository } from './repositories';
import { KafkaModule } from './kafka';
@Global()
@Module({
  imports: [KafkaModule.register()],
  providers: [TokenRepository],
  exports: [TokenRepository, KafkaModule],
})
export class SharedModule {}
