import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrivateAuthController } from './controller/private-auth.controller';
import { PublicAuthController } from './controller/public-auth.controller';
import { AuthRepository } from './repository';
import { AuthService } from './service/auth.service';

@Module({
  imports: [ConfigModule],
  controllers: [PublicAuthController, PrivateAuthController],
  providers: [AuthService, AuthRepository],
})
export class AuthModule {}
