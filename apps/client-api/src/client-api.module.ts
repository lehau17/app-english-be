import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';
import { AuthModule } from './domains/auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [ClientApiController],
    providers: [ClientApiService],
})
export class ClientApiModule { }
