import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { RequestContextMiddleware } from '@app/shared/middleware/request-context.middleware';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';
import { AuthModule } from './domains/auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule, SharedModule],
    controllers: [ClientApiController],
    providers: [ClientApiService],
})
export class ClientApiModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestContextMiddleware).forRoutes('*');
    }
}

