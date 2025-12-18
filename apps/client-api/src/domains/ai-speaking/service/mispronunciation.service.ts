import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiSpeakingRepository } from '../repository/ai-speaking.repository';

@Injectable()
export class MispronunciationService {
    private readonly logger = new Logger(MispronunciationService.name);

    constructor(private readonly repository: AiSpeakingRepository) { }

    /**
     * Log a mispronounced word for a user.
     * Updates or creates a MispronounceWord record and increments the user's error counter.
     */
    async logError(params: {
        userId: string;
        word: string;
        phoneme?: string;
        contextSentence: string;
        source: string;
        userPronunciation?: string;
    }): Promise<void> {
        const { userId, word, phoneme, contextSentence, source, userPronunciation } = params;
        const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');

        try {
            // 1. Upsert MispronounceWord
            // We use a transaction to ensure both the word log and user counter are updated
            await this.repository.prismaClient.$transaction(async (tx) => {
                const existing = await tx.mispronounceWord.findUnique({
                    where: {
                        userId_word: {
                            userId,
                            word: cleanWord,
                        },
                    },
                });

                if (existing) {
                    await tx.mispronounceWord.update({
                        where: { id: existing.id },
                        data: {
                            errorCount: { increment: 1 },
                            lastErrorAt: new Date(),
                            contextSentence, // Update latest context
                            problematicPhoneme: phoneme, // Update latest phoneme issue
                            userPronunciation,
                        },
                    });
                } else {
                    await tx.mispronounceWord.create({
                        data: {
                            userId,
                            word: cleanWord,
                            contextSentence,
                            source,
                            problematicPhoneme: phoneme,
                            userPronunciation,
                            errorCount: 1,
                        },
                    });
                }

                // 2. Increment User's global pronunciation error counter
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        pronunciationErrorCounter: { increment: 1 },
                    },
                });
            });

            this.logger.debug(
                `Logged mispronunciation for user ${userId}: word="${cleanWord}", phoneme="${phoneme}"`
            );
        } catch (error) {
            this.logger.error(
                `Failed to log mispronunciation for user ${userId}: ${error.message}`,
                error.stack
            );
        }
    }

    /**
     * Fetch top mispronounced words for remedial practice
     */
    async getTopErrors(userId: string, limit: number = 5) {
        return this.repository.prismaClient.mispronounceWord.findMany({
            where: { userId },
            orderBy: [
                { errorCount: 'desc' },
                { lastErrorAt: 'desc' },
            ],
            take: limit,
        });
    }
}
