import { Module } from '@nestjs/common';
import { PublicAuthController } from './controller/public-auth.controller';
import { AuthRepository } from './repository';
import { AuthService } from './service/auth.service';
import { PrivateAuthController } from './controller/private-auth.controller';

@Module({
  controllers: [PublicAuthController, PrivateAuthController],
  providers: [AuthService, AuthRepository],
})
export class AuthModule {}
