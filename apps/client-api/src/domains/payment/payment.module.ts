import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PaymentController, PaymentWebhookController } from './controller/payment.controller';
import { PaymentRepository } from './repository/payment.repository';
import { PaymentService } from './service/payment.service';
import { VNPayService } from './service/vnpay.service';

@Module({
  imports: [DatabaseModule, SharedModule, ConfigModule],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [PaymentService, VNPayService, PaymentRepository],
  exports: [PaymentService, PaymentRepository],
})
export class PaymentModule {}
