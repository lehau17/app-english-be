import { PrismaRepository } from '@app/database';
import {
  KafkaConfigService,
  KafkaTopic,
  AiSpeakingSessionCompletedEvent,
  MispronounceWordPayload,
  PracticeAttemptCompletedEvent,
} from '@app/shared';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { PersonalizationLLMService } from './personalization-llm.service';
import { SRSSpeakingService } from './srs-speaking.service';

@Injectable()
export class MispronounceWordListener implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private kafka: Kafka;
  private readonly logger = new Logger(MispronounceWordListener.name);

  constructor(
    private readonly kafkaConfigService: KafkaConfigService,
    private readonly prisma: PrismaRepository,
    private readonly llmService: PersonalizationLLMService,
    private readonly srsService: SRSSpeakingService,
  ) {
    this.kafka = new Kafka(this.kafkaConfigService.getConsumerConfig());
    this.consumer = this.kafka.consumer({
      groupId: 'background-worker-mispronounce',
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
      this.logger.log('MispronounceWord listener connected to Kafka');

      await this.consumer.subscribe({
        topics: [
          KafkaTopic.AI_SPEAKING_SESSION_COMPLETED,
          KafkaTopic.SPEAKING_PRACTICE_ATTEMPT_COMPLETED,
        ],
        fromBeginning: false,
      });

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

      this.logger.log('MispronounceWord consumer running');
    } catch (error) {
      this.logger.error(
        'Failed to initialize MispronounceWord listener',
        error,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
      this.logger.log('MispronounceWord listener disconnected');
    } catch (error) {
      this.logger.error(
        'Failed to disconnect MispronounceWord listener',
        error,
      );
    }
  }

  private async processMessage(topic: string, partition: number, message: any) {
    const raw = message.value?.toString();

    if (!raw) {
      return this.logger.warn('Received empty message', { topic, partition });
    }

    try {
      const payload = JSON.parse(raw);

      if (topic === KafkaTopic.AI_SPEAKING_SESSION_COMPLETED) {
        await this.handleFreeChatCompleted(
          payload as AiSpeakingSessionCompletedEvent,
        );
      } else if (topic === KafkaTopic.SPEAKING_PRACTICE_ATTEMPT_COMPLETED) {
        await this.handlePracticeCompleted(
          payload as PracticeAttemptCompletedEvent,
        );
      }
    } catch (err) {
      this.logger.error(`Failed to process message: ${err.message}`, err.stack);
    }
  }

  /**
   * Handle Free Chat session completed - extract mispronounce words from turns
   */
  private async handleFreeChatCompleted(
    event: AiSpeakingSessionCompletedEvent,
  ) {
    const { sessionId, userId } = event;
    this.logger.log(`Processing free chat session ${sessionId}`);

    const session = await this.prisma.aiSpeakingSession.findUnique({
      where: { id: sessionId },
      include: { turns: true },
    });

    if (!session) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return;
    }

    const wordsToProcess: MispronounceWordPayload[] = [];

    for (const turn of session.turns) {
      const feedback = turn.pronunciationFeedback as any;
      if (feedback?.mispronounceWords) {
        wordsToProcess.push(...feedback.mispronounceWords);
      }
    }

    if (wordsToProcess.length > 0) {
      await this.upsertMispronounceWords(userId, wordsToProcess, 'free_chat');
    }
  }

  /**
   * Handle Practice attempt completed - directly use mispronounce words from event
   */
  private async handlePracticeCompleted(event: PracticeAttemptCompletedEvent) {
    const { userId, mispronounceWords } = event;
    this.logger.log(`Processing practice attempt for user ${userId}`);

    if (mispronounceWords?.length > 0) {
      await this.upsertMispronounceWords(userId, mispronounceWords, 'practice');
    }
  }

  /**
   * Upsert mispronounce words and check for LLM trigger
   * Now includes SM-2 spaced repetition calculation
   */
  private async upsertMispronounceWords(
    userId: string,
    words: MispronounceWordPayload[],
    source: 'free_chat' | 'practice',
  ) {
    for (const word of words) {
      const normalizedWord = word.word.toLowerCase().trim();

      if (!normalizedWord) continue;

      // First check if word exists to get current SRS data
      const existingWord = await this.prisma.mispronounceWord.findUnique({
        where: { userId_word: { userId, word: normalizedWord } },
      });

      // Calculate SM-2 for mispronounced word (quality is low since it's an error)
      const quality = this.srsService.getQualityForMispronounce(word.errorType);
      const srsUpdate = this.srsService.calculateNextReview(
        existingWord,
        quality,
      );

      await this.prisma.mispronounceWord.upsert({
        where: { userId_word: { userId, word: normalizedWord } },
        update: {
          errorCount: { increment: 1 },
          lastErrorAt: new Date(),
          // SM-2 fields
          easeFactor: srsUpdate.easeFactor,
          interval: srsUpdate.interval,
          repetitions: srsUpdate.repetitions,
          nextReviewDate: srsUpdate.nextReviewDate,
          lastReviewedAt: srsUpdate.lastReviewedAt,
          // Update context if provided
          ...(word.contextSentence && {
            contextSentence: word.contextSentence,
          }),
          ...(word.errorType && { errorType: word.errorType }),
          ...(word.problematicPhoneme && {
            problematicPhoneme: word.problematicPhoneme,
          }),
        },
        create: {
          userId,
          word: normalizedWord,
          contextSentence: word.contextSentence,
          source,
          errorType: word.errorType,
          problematicPhoneme: word.problematicPhoneme,
          expectedPronunciation: word.expectedPronunciation,
          userPronunciation: word.userPronunciation,
          // SM-2 initial values
          easeFactor: srsUpdate.easeFactor,
          interval: srsUpdate.interval,
          repetitions: srsUpdate.repetitions,
          nextReviewDate: srsUpdate.nextReviewDate,
          lastReviewedAt: srsUpdate.lastReviewedAt,
        },
      });

      this.logger.debug(
        `Upserted mispronounce word: ${normalizedWord} (nextReview: ${srsUpdate.nextReviewDate.toISOString()})`,
      );
    }

    // Check and trigger LLM analysis
    await this.checkAndTriggerLLM(userId);
  }

  /**
   * Trigger LLM analysis when totalWords % 10 === 0
   */
  private async checkAndTriggerLLM(userId: string) {
    const totalWords = await this.prisma.mispronounceWord.count({
      where: { userId },
    });

    this.logger.debug(`User ${userId} has ${totalWords} mispronounce words`);

    // Trigger LLM every 10 words
    if (totalWords > 0 && totalWords % 10 === 0) {
      this.logger.log(
        `Triggering LLM analysis for user ${userId} (total=${totalWords})`,
      );
      await this.llmService.analyzeAndGenerateDrill(userId);
    }
  }
}
