import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KafkaConfigService {
  constructor(private readonly configService: ConfigService) {}

  get brokerAddress(): string {
    const brokers = this.configService.get<string>('KAFKA_BROKERS');
    if (brokers) {
      return brokers;
    }
    return this.configService.get<string>(
      'KAFKA_BROKER_ADDRESS',
      'localhost:19092',
    );
  }

  get clientId(): string {
    return this.configService.get<string>(
      'KAFKA_CLIENT_ID',
      'gas-station-backend',
    );
  }

  get groupId(): string {
    return this.configService.get<string>(
      'KAFKA_GROUP_ID',
      'gas-station-backend-group',
    );
  }

  getConsumerConfig(groupId?: string) {
    return {
      clientId: this.clientId,
      brokers: [this.brokerAddress],
      groupId: groupId || this.groupId,
      retry: {
        initialRetryTime: 300,
        retries: 5,
        maxRetryTime: 30000,
        factor: 0.2,
        multiplier: 2,
      },
      connectionTimeout: 10000,
      requestTimeout: 30000,
    };
  }

  /**
   * Get consumer configuration with specific options for the consumer
   * @param options Additional consumer options
   * @returns Consumer configuration
   */
  getConsumerConfigWithOptions(options: any = {}) {
    return {
      ...this.getConsumerConfig(options.groupId),
      ...options,
    };
  }

  getProducerConfig() {
    return {
      clientId: this.clientId,
      brokers: [this.brokerAddress],
      retry: {
        initialRetryTime: 300,
        retries: 5, // Tăng từ 3 lên 5
        maxRetryTime: 30000,
        factor: 2,
      },
      connectionTimeout: 10000, // Tăng từ 3000 lên 10000ms
      requestTimeout: 30000, // Thêm request timeout
    };
  }
}
