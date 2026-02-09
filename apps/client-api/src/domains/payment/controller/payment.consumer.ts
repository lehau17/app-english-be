import {
  KafkaConfigService,
  KafkaProducerService,
  KafkaTopic,
} from '@app/shared';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { VNPayReturnData } from '../service/vnpay.service';
import { PaymentService } from '../service/payment.service';

@Injectable()
export class PaymentConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private kafka: Kafka;
  private readonly logger = new Logger(PaymentConsumer.name);

  constructor(
    private readonly kafkaConfigService: KafkaConfigService,
    private readonly kafkaProducerService: KafkaProducerService,
    private readonly paymentService: PaymentService,
  ) {
    this.kafka = new Kafka(this.kafkaConfigService.getConsumerConfig());
    this.consumer = this.kafka.consumer({
      groupId: 'payment-consumer',
    });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      this.logger.log('Payment consumer connected to Kafka');

      await this.consumer.subscribe({
        topic: KafkaTopic.PAYMENT_VNPAY_RETURN,
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.processMessage(topic, partition, message);
        },
      });

      this.logger.log('Payment consumer running');
    } catch (error) {
      this.logger.error('Failed to initialize payment consumer', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
      this.logger.log('Payment consumer disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect payment consumer', error);
    }
  }

  private async processMessage(topic: string, partition: number, message: any) {
    const raw = message.value?.toString();
    if (!raw) return;

    try {
      const returnData: VNPayReturnData = JSON.parse(raw);
      this.logger.log(
        `Processing VNPay return from Kafka: ${returnData.vnp_TxnRef}`,
      );

      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        try {
          await this.paymentService.handleVNPayReturn(returnData);
          this.logger.log(
            `Successfully processed VNPay return for ${returnData.vnp_TxnRef}`,
          );
          return; // Success
        } catch (err) {
          if (attempt <= MAX_RETRIES) {
            const delay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
            this.logger.warn(
              `Attempt ${attempt} failed for ${returnData.vnp_TxnRef}. Retrying in ${delay}ms...`,
              err,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            // All attempts failed
            throw err;
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to process payment message after retries: ${error.message}`,
        error.stack,
      );

      // Send to DLQ
      try {
        await this.kafkaProducerService.send(
          KafkaTopic.PAYMENT_VNPAY_RETURN_DLQ,
          JSON.parse(raw), // Ensure valid JSON structure for DLQ
        );
        this.logger.log(
          `Message moved to DLQ: ${KafkaTopic.PAYMENT_VNPAY_RETURN_DLQ}`,
        );
      } catch (dlqError) {
        this.logger.error(
          `Failed to send message to DLQ: ${dlqError.message}`,
          dlqError.stack,
        );
      }
    }
  }
}
