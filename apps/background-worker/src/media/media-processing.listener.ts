import { PrismaRepository } from '@app/database';
import {
    KafkaConfigService,
    KafkaTopic,
    MediaProcessingMessage,
} from '@app/shared';
import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { MediaProcessorService } from './media-processor.service';

@Injectable()
export class MediaProcessingListener implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private kafka: Kafka;
  private readonly logger = new Logger(MediaProcessingListener.name);

  constructor(
    private readonly kafkaConfigService: KafkaConfigService,
    private readonly prisma: PrismaRepository,
    private readonly mediaProcessorService: MediaProcessorService,
  ) {
    this.kafka = new Kafka(this.kafkaConfigService.getConsumerConfig());
    this.consumer = this.kafka.consumer({
      groupId: 'background-worker-media-processing',
      retry: {
        initialRetryTime: 300,
        retries: 3,
        maxRetryTime: 30000,
        factor: 0.2,
        multiplier: 2,
      },
    });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      this.logger.log('Media processing consumer connected');

      await this.consumer.subscribe({
        topics: [KafkaTopic.MEDIA_PROCESSING],
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.processMessage(topic, partition, message);
        },
      });

      this.logger.log('Media processing listener started');
    } catch (error) {
      this.logger.error('Failed to start media processing listener:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
      this.logger.log('Media processing consumer disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting consumer:', error);
    }
  }

  private async processMessage(topic: string, partition: number, message: any) {
    const key = message.key?.toString();
    const raw = message.value?.toString();

    this.logger.log('Received media processing message:', {
      topic,
      partition,
      key,
      offset: message.offset,
    });

    if (!raw) {
      return this.logger.warn('Received empty message', { topic, partition });
    }

    const startTime = Date.now();

    try {
      const payload: MediaProcessingMessage = JSON.parse(raw);

      this.logger.log(
        `Processing media: ${payload.operation} ${payload.mediaId} (${payload.mimeType})`,
      );

      await this.processMedia(payload);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Media processing completed for ${payload.mediaId} in ${processingTime}ms`,
      );
    } catch (err) {
      this.logger.error('Message processing failed:', {
        topic,
        partition,
        key,
        error: (err as Error).message,
        stack: (err as Error).stack,
      });
    }
  }

  private async processMedia(message: MediaProcessingMessage): Promise<void> {
    if (message.operation !== 'PROCESS') {
      this.logger.warn(`Unknown operation: ${message.operation}`);
      return;
    }

    // Get MediaFile from database
    const mediaFile = await this.prisma.mediaFile.findUnique({
      where: { id: message.mediaId },
    });

    if (!mediaFile) {
      throw new Error(`MediaFile not found: ${message.mediaId}`);
    }

    // Process based on mimeType
    if (message.mimeType.startsWith('video/')) {
      await this.mediaProcessorService.processVideo(
        message.mediaId,
        message.url,
        message.processingOptions,
      );
    } else if (message.mimeType.startsWith('audio/')) {
      await this.mediaProcessorService.processAudio(
        message.mediaId,
        message.url,
        message.processingOptions,
      );
    } else if (message.mimeType.startsWith('image/')) {
      await this.mediaProcessorService.processImage(
        message.mediaId,
        message.url,
      );
    } else {
      this.logger.warn(
        `Unsupported mimeType for processing: ${message.mimeType}`,
      );
      // Mark as processed anyway (no processing needed)
      await this.prisma.mediaFile.update({
        where: { id: message.mediaId },
        data: { isProcessed: true },
      });
    }
  }
}





