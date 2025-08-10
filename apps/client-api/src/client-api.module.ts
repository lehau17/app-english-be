import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';
import { AuthModule } from './domains/auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule, SharedModule],
    controllers: [ClientApiController],
    providers: [ClientApiService],
})
export class ClientApiModule { }
