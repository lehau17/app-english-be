import { GeminiService } from '@app/shared/ai/gemini.service';
import { KafkaProducerService } from '@app/shared/kafka/kafka-producer.service';
import { KafkaTopic } from '@app/shared/kafka/kafka-topic.enum';
import { Injectable, Logger } from '@nestjs/common';
import { ActivityType, ActivityVariant, DifficultyLevel } from '@prisma/client';
import { ActivityVariantRepository } from '../repository/activity-variant.repository';
import { ContentValidationService } from './content-validation.service';
import { PromptTemplateService } from './prompt-template.service';

interface GenerationParams {
  userId?: string;
  activityType: ActivityType;
  proficiencyLevel?: string; // A1, A2, B1, B2, C1, C2
  difficulty?: DifficultyLevel;
  skill?: string; // e.g., 'business_vocabulary', 'grammar_past_tense'
  weakness?: string; // User's specific weakness to target
  count?: number; // Number of exercises to generate
  context?: string; // Additional context for generation
}

interface GenerationResult {
  variants: ActivityVariant[];
  qualityScore: number;
  generationTime: number;
  promptTemplateId: string;
}

/**
 * Service for generating activities using Gemini AI
 * Supports both synchronous and asynchronous (Kafka) generation
 */
@Injectable()
export class ActivityGeneratorService {
  private readonly logger = new Logger(ActivityGeneratorService.name);
  private readonly DEFAULT_MODEL = 'gemini-2.5-flash';
  private readonly GENERATION_TIMEOUT = 30000; // 30 seconds

  constructor(
    private readonly geminiService: GeminiService,
    private readonly promptTemplateService: PromptTemplateService,
    private readonly contentValidationService: ContentValidationService,
    private readonly activityVariantRepository: ActivityVariantRepository,
    private readonly kafkaProducer: KafkaProducerService,
  ) { }

  /**
   * Generate activities synchronously
   * Use for real-time requests or testing
   */
  async generateSync(params: GenerationParams): Promise<GenerationResult> {
    const startTime = Date.now();
    this.logger.log(
      `Generating ${params.count || 1} ${params.activityType} activities (sync)`,
    );

    try {
      // 1. Build prompt from template
      const { template, systemPrompt, userPrompt } =
        await this.promptTemplateService.buildPrompt({
          activityType: params.activityType,
          difficulty: params.difficulty,
          skill: params.skill,
          variables: {
            proficiencyLevel: params.proficiencyLevel || 'B1',
            weakness: params.weakness || 'general',
            count: params.count || 5,
            context: params.context || '',
          },
        });

      // 2. Generate content with Gemini
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      const rawContent =
        await this.geminiService.generateJSONResponse(fullPrompt);
      const content = JSON.parse(rawContent);

      // 3. Validate generated content
      const validation = await this.contentValidationService.validate(
        content,
        params.activityType,
        params.proficiencyLevel,
      );

      if (!validation.isValid) {
        this.logger.warn(
          `Generated content failed validation: ${validation.issues.join(', ')}`,
        );
        // Still store but mark as unapproved
      }

      // 4. Store activity variants
      const variants = await this.storeActivityVariants(
        content,
        params,
        template.id,
        validation.qualityScore,
      );

      // 5. Update template usage
      await this.promptTemplateService.incrementUsage(template.id);

      const generationTime = Date.now() - startTime;
      this.logger.log(
        `Generated ${variants.length} variants in ${generationTime}ms (quality: ${validation.qualityScore})`,
      );

      return {
        variants,
        qualityScore: validation.qualityScore,
        generationTime,
        promptTemplateId: template.id,
      };
    } catch (error) {
      this.logger.error('Sync generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate activities asynchronously via Kafka
   * Use for background processing or large batches
   */
  async generateAsync(params: GenerationParams): Promise<{ jobId: string }> {
    const jobId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(
      `Queuing async generation: ${params.activityType} (job: ${jobId})`,
    );

    try {
      this.kafkaProducer.emit(KafkaTopic.ACTIVITY_GENERATION, {
        jobId,
        timestamp: new Date().toISOString(),
        params,
      });

      return { jobId };
    } catch (error) {
      this.logger.error('Failed to queue async generation:', error);
      throw error;
    }
  }

  /**
   * Store generated activity variants in database
   */
  private async storeActivityVariants(
    content: any,
    params: GenerationParams,
    promptTemplateId: string,
    qualityScore: number,
  ): Promise<ActivityVariant[]> {
    const variants: ActivityVariant[] = [];

    // Handle different content structures
    const activities = this.extractActivities(content, params.activityType);

    for (const activityContent of activities) {
      const variant = await this.activityVariantRepository.create({
        activityType: params.activityType,
        difficulty: params.difficulty || DifficultyLevel.intermediate,
        skill: params.skill || 'general',
        title: activityContent.title || `${params.activityType} Exercise`,
        description: activityContent.description,
        content: activityContent,
        mediaUrls: activityContent.mediaUrls || [],
        promptTemplateId,
        generationParams: params,
        aiModel: this.DEFAULT_MODEL,
      });

      // Auto-approve high-quality variants
      if (qualityScore >= 95) {
        await this.activityVariantRepository.approve(variant.id);
      }

      variants.push(variant);
    }

    return variants;
  }

  /**
   * Extract individual activities from generated content
   * Handles various response formats from Gemini
   */
  private extractActivities(content: any, activityType: ActivityType): any[] {
    // If content is already an array
    if (Array.isArray(content)) {
      return content;
    }

    // If content has 'activities' or 'exercises' array
    if (content.activities && Array.isArray(content.activities)) {
      return content.activities;
    }

    if (content.exercises && Array.isArray(content.exercises)) {
      return content.exercises;
    }

    // If content has 'questions' array (for quiz-type activities)
    if (content.questions && Array.isArray(content.questions)) {
      return [content]; // Wrap entire content as single activity
    }

    // If content has 'words' array (for vocab activities)
    if (content.words && Array.isArray(content.words)) {
      return [content];
    }

    // Default: treat entire content as single activity
    return [content];
  }

  /**
   * Batch generate multiple activity types
   * Useful for populating learning paths
   */
  async batchGenerate(params: {
    userId?: string;
    activityTypes: ActivityType[];
    difficulty: DifficultyLevel;
    proficiencyLevel?: string;
    skill?: string;
  }): Promise<GenerationResult[]> {
    this.logger.log(
      `Batch generating ${params.activityTypes.length} activity types`,
    );

    const results: GenerationResult[] = [];

    for (const activityType of params.activityTypes) {
      try {
        const result = await this.generateSync({
          userId: params.userId,
          activityType,
          difficulty: params.difficulty,
          proficiencyLevel: params.proficiencyLevel,
          skill: params.skill,
          count: 5,
        });

        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to generate ${activityType} in batch:`,
          error,
        );
        // Continue with other types
      }
    }

    return results;
  }

  /**
   * Regenerate activity variant (for low-quality variants)
   */
  async regenerateVariant(variantId: string): Promise<ActivityVariant> {
    const existing = await this.activityVariantRepository.findById(variantId);
    if (!existing) {
      throw new Error('Variant not found');
    }

    this.logger.log(`Regenerating variant: ${variantId}`);

    // Use original generation params if available
    const params = (existing.generationParams as any) || {
      activityType: existing.activityType,
      difficulty: existing.difficulty,
      skill: existing.skill,
    };

    const result = await this.generateSync(params);

    // Delete old variant, return new one
    await this.activityVariantRepository.delete(variantId);

    return result.variants[0];
  }

  /**
   * Get generation statistics
   */
  async getGenerationStats(): Promise<{
    totalGenerated: number;
    byType: Record<string, number>;
    averageQuality: number;
    approvalRate: number;
  }> {
    const stats = await this.activityVariantRepository.getStatistics();

    return {
      totalGenerated: stats.total,
      byType: stats.byType,
      averageQuality: 0, // TODO: Calculate from quality scores
      approvalRate: stats.approved / stats.total,
    };
  }
}
