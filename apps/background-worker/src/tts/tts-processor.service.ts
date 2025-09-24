import { PrismaRepository } from '@app/database';
import { TTSTaskMessage, TTSTaskResult, TtsService } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Injectable()
export class TtsProcessorService {
  private readonly logger = new Logger(TtsProcessorService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly ttsService: TtsService,
  ) {}

  @MessagePattern('tts-audio-generation')
  async processTtsTask(@Payload() message: TTSTaskMessage): Promise<TTSTaskResult> {
    this.logger.log(`Processing TTS task: ${message.taskId} for activity: ${message.activityId}`);

    const startTime = Date.now();
    let processedItems = 0;

    try {
      // Fetch latest activity content
      const activity = await this.prisma.activity.findUnique({
        where: { id: message.activityId }
      });

      if (!activity) {
        throw new Error(`Activity not found: ${message.activityId}`);
      }

      const content: any = activity.content ?? {};

      if (content.kind !== 'vocab') {
        this.logger.warn(`Activity ${message.activityId} is not vocab type, skipping TTS processing`);
        return {
          activityId: message.activityId,
          taskId: message.taskId,
          success: true,
          processedItems: 0,
          timestamp: Date.now(),
        };
      }

      const items: any[] = (content.data && content.data.items) || [];

      // Process each item index that needs audio
      for (const idx of message.itemsIndex) {
        if (idx >= items.length) continue;

        const item = items[idx];
        const word = item?.word;

        if (!word) continue;

        try {
          this.logger.debug(`Generating audio for word: "${word}" in language: ${message.language}`);

          const { url } = await this.ttsService.createAudioWithUrl(
            word,
            message.language.split('-')[0] ?? 'en'
          );

          items[idx].audioUrl = url;
          processedItems++;

          this.logger.debug(`Successfully generated audio for "${word}": ${url}`);
        } catch (error) {
          this.logger.error(`Failed to generate audio for word "${word}": ${error.message}`);
          // Continue processing other words even if one fails
        }
      }

      // Update activity with new audio URLs
      await this.prisma.activity.update({
        where: { id: message.activityId },
        data: { content },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `TTS task ${message.taskId} completed: ${processedItems}/${message.itemsIndex.length} items processed in ${duration}ms`
      );

      return {
        activityId: message.activityId,
        taskId: message.taskId,
        success: true,
        processedItems,
        timestamp: Date.now(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `TTS task ${message.taskId} failed after ${duration}ms: ${error.message}`,
        error.stack
      );

      return {
        activityId: message.activityId,
        taskId: message.taskId,
        success: false,
        processedItems,
        errorMessage: error.message,
        timestamp: Date.now(),
      };
    }
  }

  async getProcessingStats(): Promise<{
    isHealthy: boolean;
    lastProcessedAt?: number;
    totalProcessedToday?: number;
  }> {
    // Simple health check - could be expanded with more metrics
    return {
      isHealthy: true,
      lastProcessedAt: Date.now(),
      totalProcessedToday: 0, // Could track this in Redis or DB
    };
  }
}
