import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { PaymentModule } from '../payment/payment.module';
import { LandingPageController } from './landing-page.controller';
import { LandingPageService } from './landing-page.service';

@Module({
  imports: [DatabaseModule, PaymentModule],
  controllers: [LandingPageController],
  providers: [LandingPageService],
  exports: [LandingPageService],
})
export class LandingPageModule {}
