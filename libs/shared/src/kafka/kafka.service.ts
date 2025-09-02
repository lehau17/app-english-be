import { Inject, Injectable } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService {
  constructor(
    @Inject('KAFKA_SERVICE') private readonly clientKafka: ClientKafka,
  ) {}

  send(topic: string, message: any) {
    return this.clientKafka.emit(topic, message);
  }
}
