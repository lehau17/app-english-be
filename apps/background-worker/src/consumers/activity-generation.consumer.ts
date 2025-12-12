import { Injectable, Logger } from '@nestjs/common';
import { ActivityGeneratorService } from '../../../client-api/src/domains/learning-path/service/activity-generator.service';

/**
 * Kafka consumer for asynchronous activity generation
 * Processes jobs from 'activity-generation' topic
 */
@Injectable()
export class ActivityGenerationConsumer {
  private readonly logger = new Logger(ActivityGenerationConsumer.name);

  constructor(
    private readonly activityGenerator: ActivityGeneratorService,
  ) {}

  /**
   * Handle activity generation job
   * Triggered by Kafka message from ActivityGeneratorService.generateAsync()
   */
  async handleActivityGeneration(message: any): Promise<void> {
    const { jobId, params, timestamp } = message;

    this.logger.log(`Processing generation job: ${jobId} (queued at ${timestamp})`);

    try {
      const startTime = Date.now();

      // Generate activities synchronously (worker context)
      const result = await this.activityGenerator.generateSync(params);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Job ${jobId} completed: ${result.variants.length} variants generated in ${processingTime}ms (quality: ${result.qualityScore})`,
      );

      // TODO: Optionally emit completion event for real-time updates
      // await this.kafkaProducer.sendMessage('activity-generation-complete', {
      //   jobId,
      //   variantIds: result.variants.map(v => v.id),
      //   qualityScore: result.qualityScore,
      // });
    } catch (error) {
      this.logger.error(`Job ${jobId} failed:`, error);
      // TODO: Implement retry logic or dead-letter queue
      throw error;
    }
  }
}
