import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';

@Module({
    imports: [DatabaseModule],
    controllers: [ClientApiController],
    providers: [ClientApiService],
})
export class ClientApiModule { }
