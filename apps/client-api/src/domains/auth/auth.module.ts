import { Module } from '@nestjs/common';
import { AuthController } from './controller/auth.controller';
import { AuthRepository } from './repository';
import { AuthService } from './service/auth.service';

@Module({
    controllers: [AuthController],
    providers: [AuthService, AuthRepository],
})
export class AuthModule { }



