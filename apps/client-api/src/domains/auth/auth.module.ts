import { Module } from '@nestjs/common';
import { PublicAuthController } from './controller/public-auth.controller';
import { AuthRepository } from './repository';
import { AuthService } from './service/auth.service';

@Module({
    controllers: [PublicAuthController],
    providers: [AuthService, AuthRepository],
})
export class AuthModule { }



