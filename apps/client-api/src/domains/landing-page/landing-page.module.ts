import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PaymentModule } from '../payment/payment.module';
import { LandingPageController } from './landing-page.controller';
import { LandingPageService } from './landing-page.service';

@Module({
  imports: [
    DatabaseModule,
    SharedModule,
    PaymentModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get('ENROLLMENT_VERIFICATION_SECRET') ||
          config.get('JWT_SECRET'),
        signOptions: { expiresIn: '30m' },
      }),
    }),
  ],
  controllers: [LandingPageController],
  providers: [LandingPageService],
  exports: [LandingPageService],
})
export class LandingPageModule {}
