import { DatabaseModule } from '@app/database';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CourseCompletionService } from './certificate/course-completion.service';
import { KafkaModule } from './kafka';
import { Neo4jModule } from './neo4j';
import { RedisModule } from './redis';
import { TokenRepository } from './repositories';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    KafkaModule,
    Neo4jModule,
    RedisModule,
  ],
  providers: [
    TokenRepository,
    CourseCompletionService,
  ],
  exports: [
    KafkaModule,
    Neo4jModule,
    RedisModule,
    CourseCompletionService,
    TokenRepository,
  ],
})
export class SharedModule {}
