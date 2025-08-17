import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaService } from './kafka.service';

@Module({})
export class KafkaModule {
    static register(): DynamicModule {
        return {
            module: KafkaModule,
            imports: [
                ClientsModule.register([
                    {
                        name: 'KAFKA_SERVICE',
                        transport: Transport.KAFKA,
                        options: {
                            client: {
                                brokers: process.env.KAFKA_BROKERS.split(','),
                            },
                            consumer: {
                                groupId: 'client-api-consumer',
                            },
                            producer: {
                                allowAutoTopicCreation: true,
                            },

                        },
                    },
                ]),
            ],
            providers: [KafkaService],
            exports: [KafkaService],
        };
    }
}
