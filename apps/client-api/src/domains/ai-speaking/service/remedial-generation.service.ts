import { GeminiService } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiSpeakingRepository } from '../repository/ai-speaking.repository';
import { MispronunciationService } from './mispronunciation.service';

@Injectable()
export class RemedialGenerationService {
    private readonly logger = new Logger(RemedialGenerationService.name);

    constructor(
        private readonly repository: AiSpeakingRepository,
        private readonly mispronunciationService: MispronunciationService,
        private readonly geminiService: GeminiService,
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async checkAndGenerateDrills() {
        this.logger.debug('Running remedial exercise generation check...');

        try {
            // 1. Find users with potential need for remedial generation
            // This is a naive query; in production, use cursor or chunking
            const candidates = await this.repository.prismaClient.user.findMany({
                where: {
                    pronunciationErrorCounter: {
                        gte: 10, // Minimum threshold to even consider
                    },
                },
                select: {
                    id: true,
                    pronunciationErrorCounter: true,
                },
            });

            for (const user of candidates) {
                await this.processUser(user.id, user.pronunciationErrorCounter);
            }
        } catch (error) {
            this.logger.error('Error in remedial generation cron:', error);
        }
    }

    private async processUser(userId: string, currentErrorCount: number) {
        // 2. Check if we already generated for this threshold
        const latestExercise = await this.repository.prismaClient.remedialExercise.findFirst({
            where: { userId },
            orderBy: { triggerCount: 'desc' },
        });

        const lastTriggerCount = latestExercise?.triggerCount ?? 0;

        // Logic: Trigger if we've crossed a new 10-count threshold
        // e.g. last=10, current=21 -> triggers (floor(21/10) > floor(10/10))
        const currentLevel = Math.floor(currentErrorCount / 10);
        const lastLevel = Math.floor(lastTriggerCount / 10);

        if (currentLevel > lastLevel) {
            this.logger.log(`Generating remedial exercise for user ${userId} (Errors: ${currentErrorCount})`);
            await this.generateExercise(userId, currentLevel * 10);
        }
    }

    private async generateExercise(userId: string, triggerCount: number) {
        // 3. Get top errors
        const errors = await this.mispronunciationService.getTopErrors(userId, 5);

        if (errors.length === 0) return;

        const words = errors.map(e => e.word);
        const phonemes = [...new Set(errors.map(e => e.problematicPhoneme).filter(Boolean))];
        const sourceWordIds = errors.map(e => e.id);

        // 4. Generate Content via Gemini
        const prompt = `
      Create a remedial English pronunciation exercise.
      Target Words: ${words.join(', ')}
      Target Phonemes: ${phonemes.join(', ')}

      Generate 5 practice sentences. Each sentence should naturally include at least one target word.
      Return strictly a JSON object with this structure:
      {
        "sentences": [
          {
             "text": "Sentence string",
             "targetWord": "word from list",
             "explanation": "Brief tip on pronouncing the phoneme"
          }
        ],
        "focus_phonemes": ["..."]
      }
    `;

        try {
            const response = await this.geminiService.generateResponse(prompt);
            // Clean markdown if present
            const jsonStr = response.replace(/```json|```/g, '').trim();
            const content = JSON.parse(jsonStr);

            // 5. Save to DB
            await this.repository.prismaClient.remedialExercise.create({
                data: {
                    userId,
                    triggerCount,
                    sourceWordIds,
                    content,
                    status: 'pending'
                }
            });

            this.logger.log(`Remedial exercise created for user ${userId} at count ${triggerCount}`);

        } catch (error) {
            this.logger.error(`Failed to generate/save remedial exercise for user ${userId}:`, error);
        }
    }

    async listExercises(userId: string) {
        return this.repository.prismaClient.remedialExercise.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
    }
}
