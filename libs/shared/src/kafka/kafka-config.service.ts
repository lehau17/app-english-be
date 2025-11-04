import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaConfig } from 'kafkajs';

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
    const enableSasl =
      this.configService.get<string>('KAFKA_ENABLE_SASL', 'false') === 'true';
    const username = this.configService.get<string>('KAFKA_USERNAME', 'user');
    const password = this.configService.get<string>('KAFKA_PASSWORD', '');
    const mechanism = this.configService.get<string>(
      'KAFKA_SASL_MECHANISM',
      'scram-sha-256',
    );
    const connectionTimeout = this.configService.get<number>(
      'KAFKA_CONNECTION_TIMEOUT',
      30000,
    );
    const requestTimeout = this.configService.get<number>(
      'KAFKA_REQUEST_TIMEOUT',
      30000,
    );

    const config: any = {
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
      connectionTimeout,
      requestTimeout,
    };

    // Only add SASL if explicitly enabled AND password is provided
    if (enableSasl && password) {
      config.sasl = {
        mechanism: mechanism as any,
        username: username,
        password: password,
      };
    }

    return config;
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

  getProducerConfig(): KafkaConfig {
    const enableSasl =
      this.configService.get<string>('KAFKA_ENABLE_SASL', 'false') === 'true';
    const username = this.configService.get<string>('KAFKA_USERNAME', 'user');
    const password = this.configService.get<string>('KAFKA_PASSWORD', '');
    const mechanism = this.configService.get<string>(
      'KAFKA_SASL_MECHANISM',
      'scram-sha-256',
    );
    const connectionTimeout = this.configService.get<number>(
      'KAFKA_CONNECTION_TIMEOUT',
      30000,
    );
    const requestTimeout = this.configService.get<number>(
      'KAFKA_REQUEST_TIMEOUT',
      30000,
    );

    const config: any = {
      clientId: this.clientId,
      brokers: [this.brokerAddress],
      retry: {
        initialRetryTime: 300,
        retries: 5,
        maxRetryTime: 30000,
        factor: 2,
      },
      connectionTimeout,
      requestTimeout,
    };

    // Only add SASL if explicitly enabled AND password is provided
    if (enableSasl && password) {
      config.sasl = {
        mechanism: mechanism as any,
        username: username,
        password: password,
      };
    }

    return config;
  }
}
