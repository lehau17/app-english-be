import { Global, Module } from '@nestjs/common';
import { KafkaModule } from './kafka';
import { Neo4jModule } from './neo4j';
import { TokenRepository } from './repositories';

@Global()
@Module({
  imports: [KafkaModule, Neo4jModule],
  providers: [TokenRepository],
  exports: [TokenRepository, KafkaModule, Neo4jModule],
})
export class SharedModule {}
