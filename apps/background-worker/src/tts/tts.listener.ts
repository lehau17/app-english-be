import { PrismaRepository } from '@app/database';
import { KafkaConfigService, KafkaTopic, TtsService } from '@app/shared';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';

interface TTSTaskMessage {
  activityId: string;
  itemsIndex: number[];
  language: string;
  taskId: string;
  timestamp: number;
}

@Injectable()
export class TtsListener implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private kafka: Kafka;
  private readonly logger = new Logger(TtsListener.name);

  constructor(
    private readonly kafkaConfigService: KafkaConfigService,
    private readonly prisma: PrismaRepository,
    private readonly ttsService: TtsService,
  ) {
    this.kafka = new Kafka(this.kafkaConfigService.getConsumerConfig());
    this.consumer = this.kafka.consumer({
      groupId: 'background-worker-tts',
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
      this.logger.log('✅ TTS listener connected to Kafka');

      await this.consumer.subscribe({
        topics: [KafkaTopic.TTS_AUDIO_GENERATION],
        fromBeginning: false,
      });
      this.logger.log(
        `✅ Subscribed to topic: ${KafkaTopic.TTS_AUDIO_GENERATION}`,
      );

      // Event listeners
      this.consumer.on(this.consumer.events.GROUP_JOIN, (e) =>
        this.logger.log('GROUP_JOIN', e.payload),
      );
      this.consumer.on(this.consumer.events.CRASH, (e) =>
        this.logger.error('CRASH', e.payload.error),
      );

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.processMessage(topic, partition, message);
        },
      });

      this.logger.log('✅ TTS consumer running');
    } catch (error) {
      this.logger.error('Failed to initialize TTS listener', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
      this.logger.log('TTS listener disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect TTS listener', error);
    }
  }

  private async processMessage(topic: string, partition: number, message: any) {
    const key = message.key?.toString();
    const raw = message.value?.toString();

    this.logger.log('Received TTS message:', {
      topic,
      partition,
      key,
      offset: message.offset,
    });

    if (!raw) {
      return this.logger.warn('Received empty message', { topic, partition });
    }

    const startTime = Date.now();
    let processedItems = 0;

    try {
      const payload: TTSTaskMessage = JSON.parse(raw);

      this.logger.log(
        `Processing TTS task: ${payload.taskId} for activity: ${payload.activityId}`,
      );

      // Fetch latest activity content
      const activity = await this.prisma.activity.findUnique({
        where: { id: payload.activityId },
      });

      if (!activity) {
        throw new Error(`Activity not found: ${payload.activityId}`);
      }

      const content: any = activity.content ?? {};

      // Support both direct format { items: [...] } and wrapped format { kind: 'vocab', data: { items: [...] } }
      let items: any[] = [];

      if (Array.isArray(content.items)) {
        // Direct format: { items: [...] }
        items = content.items;
      } else if (content.kind === 'vocab' && content.data?.items) {
        // Wrapped format: { kind: 'vocab', data: { items: [...] } }
        items = content.data.items;
      } else if (content.data?.items) {
        // Alternative wrapped format without kind
        items = content.data.items;
      }

      if (items.length === 0) {
        this.logger.warn(
          `Activity ${payload.activityId} has no vocab items, skipping TTS processing`,
        );
        return;
      }

      // Process each item index that needs audio
      for (const idx of payload.itemsIndex) {
        if (idx >= items.length) continue;

        const item = items[idx];
        const word = item?.word;

        if (!word) continue;

        try {
          this.logger.debug(
            `Generating audio for word: "${word}" in language: ${payload.language}`,
          );

          const { url } = await this.ttsService.createAudioWithUrl(
            word,
            payload.language.split('-')[0] ?? 'en',
          );

          items[idx].audioUrl = url;
          processedItems++;

          this.logger.debug(
            `Successfully generated audio for "${word}": ${url}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to generate audio for word "${word}": ${error.message}`,
          );
          // Continue processing other words even if one fails
        }
      }

      // Update activity with new audio URLs
      await this.prisma.activity.update({
        where: { id: payload.activityId },
        data: { content },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ TTS task ${payload.taskId} completed: ${processedItems}/${payload.itemsIndex.length} items processed in ${duration}ms`,
      );
    } catch (err) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `TTS task failed after ${duration}ms: ${err.message}`,
        err.stack,
      );
    }
  }
}
