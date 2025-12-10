import { Global, Module } from '@nestjs/common';
import { CourseCompletionService } from './certificate/course-completion.service';
import { KafkaModule } from './kafka';
import { Neo4jModule } from './neo4j';
import { RedisModule } from './redis';
import { TokenRepository } from './repositories';

@Global()
@Module({
  imports: [KafkaModule, Neo4jModule, RedisModule],
  providers: [
    TokenRepository,
    CourseCompletionService,
  ],
  exports: [
    TokenRepository,
    KafkaModule,
    Neo4jModule,
    RedisModule,
    CourseCompletionService,
  ],
})
export class SharedModule {}
