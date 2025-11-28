import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * FlashcardReviewTool - Công cụ ôn tập flashcard từ vựng cho học sinh
 *
 * Tính năng:
 * - Lấy flashcard cần ôn tập theo thuật toán SRS (Spaced Repetition System)
 * - Hiển thị từ vựng với definition, pronunciation, examples
 * - Cập nhật tiến độ học sau khi review
 * - Thống kê tiến độ ôn tập
 * - Gợi ý từ vựng mới để học
 */
@Injectable()
export class FlashcardReviewTool {
  private readonly logger = new Logger(FlashcardReviewTool.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly gemini: GeminiService,
  ) {}

  /**
   * Get all flashcard tools for student agent
   */
  getTools(): DynamicStructuredTool[] {
    return [
      this.getReviewCardsTool(),
      this.getUpdateProgressTool(),
      this.getVocabStatsTool(),
      this.getNewCardsTool(),
      this.getListSummaryTool(),
    ];
  }

  /**
   * Tool 1: Lấy flashcard cần ôn tập hôm nay (SRS algorithm)
   */
  private getReviewCardsTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_flashcard_review',
      description: `Lấy các flashcard cần ôn tập hôm nay theo thuật toán SRS. Sử dụng khi học sinh hỏi:
- "ôn tập từ vựng", "review flashcard", "lấy từ cần ôn"
- "hôm nay học từ gì", "từ nào cần nhớ lại"
- "bắt đầu ôn tập", "luyện từ vựng"
Trả về danh sách flashcard với word, definition, pronunciation, examples.`,
      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe('Số lượng flashcard tối đa (mặc định 10)'),
        listId: z
          .string()
          .optional()
          .describe('ID của vocabulary list cụ thể (optional)'),
        includeNew: z
          .boolean()
          .optional()
          .default(true)
          .describe('Có bao gồm từ mới chưa học không'),
      }),
      func: async ({ userId, limit = 10, listId, includeNew = true }) => {
        try {
          this.logger.log(
            `Getting review cards for user: ${userId}, limit: ${limit}`,
          );

          const now = new Date();

          // 1. Lấy các từ cần ôn tập (nextReviewAt <= now)
          const dueCards = await this.prisma.userVocabularyProgress.findMany({
            where: {
              userId,
              nextReviewAt: { lte: now },
              ...(listId && {
                term: { unit: { listId } },
              }),
            },
            include: {
              term: {
                include: {
                  unit: {
                    include: {
                      list: {
                        select: { id: true, title: true },
                      },
                    },
                  },
                },
              },
            },
            orderBy: [
              { nextReviewAt: 'asc' }, // Ưu tiên từ quá hạn lâu nhất
              { repetitions: 'asc' }, // Ưu tiên từ khó (ít repetitions)
            ],
            take: limit,
          });

          // 2. Nếu còn slot và includeNew, lấy thêm từ mới
          let newCards: any[] = [];
          if (includeNew && dueCards.length < limit) {
            const remainingSlots = limit - dueCards.length;

            // Lấy từ user đã thêm vào list nhưng chưa có progress
            const userLists = await this.prisma.userVocabularyList.findMany({
              where: {
                userId,
                ...(listId && { listId }),
              },
              select: { listId: true },
            });

            const listIds = userLists.map((ul) => ul.listId);

            if (listIds.length > 0) {
              // Lấy termIds đã có progress
              const existingProgress =
                await this.prisma.userVocabularyProgress.findMany({
                  where: { userId },
                  select: { termId: true },
                });
              const existingTermIds = new Set(
                existingProgress.map((p) => p.termId),
              );

              // Lấy terms chưa có progress
              const newTerms = await this.prisma.vocabularyTerm.findMany({
                where: {
                  unit: { listId: { in: listIds } },
                  id: { notIn: Array.from(existingTermIds) },
                },
                include: {
                  unit: {
                    include: {
                      list: {
                        select: { id: true, title: true },
                      },
                    },
                  },
                },
                take: remainingSlots,
                orderBy: { orderIndex: 'asc' },
              });

              newCards = newTerms.map((term) => ({
                isNew: true,
                termId: term.id,
                term,
                status: 'new',
                repetitions: 0,
              }));
            }
          }

          // 3. Combine và format kết quả
          const allCards = [
            ...dueCards.map((c) => ({ ...c, isNew: false })),
            ...newCards,
          ];

          if (allCards.length === 0) {
            return JSON.stringify({
              success: true,
              message:
                'Tuyệt vời! Bạn đã ôn tập xong tất cả từ vựng hôm nay. Quay lại sau hoặc thêm từ mới vào danh sách.',
              cards: [],
              stats: {
                dueCount: 0,
                newCount: 0,
                nextReviewIn: await this.getNextReviewTime(userId),
              },
            });
          }

          const formattedCards = allCards.map((card) => {
            const term = card.term;
            return {
              cardId: term.id,
              isNew: card.isNew,
              status: card.status || 'new',
              repetitions: card.repetitions || 0,
              word: term.word,
              definition: term.definition,
              pronunciation: term.pronunciation,
              partOfSpeech: term.partOfSpeech,
              ipaUs: term.ipaUs,
              ipaUk: term.ipaUk,
              translationVi: term.translationVi,
              examples: term.examples,
              audioUrl: term.audioUrl,
              imageUrl: term.imageUrl,
              synonyms: term.synonyms,
              antonyms: term.antonyms,
              difficulty: term.difficulty,
              listTitle: term.unit?.list?.title,
              unitTitle: term.unit?.title,
            };
          });

          return JSON.stringify({
            success: true,
            message: `Có ${dueCards.length} từ cần ôn tập và ${newCards.length} từ mới.`,
            cards: formattedCards,
            stats: {
              dueCount: dueCards.length,
              newCount: newCards.length,
              totalToReview: allCards.length,
            },
            instructions: `
📖 **Hướng dẫn ôn tập:**
1. Nhìn từ vựng và cố gắng nhớ nghĩa
2. Lật card để xem định nghĩa
3. Đánh giá: "easy", "good", "hard", hoặc "again"
4. Dùng tool **update_flashcard_progress** để cập nhật kết quả

**Tips:** Đọc to từ vựng để cải thiện phát âm!
            `.trim(),
          });
        } catch (error) {
          this.logger.error('Error getting review cards:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể lấy flashcard. Vui lòng thử lại sau.',
          });
        }
      },
    });
  }

  /**
   * Tool 2: Cập nhật tiến độ sau khi review
   */
  private getUpdateProgressTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'update_flashcard_progress',
      description: `Cập nhật tiến độ ôn tập flashcard sau khi học sinh trả lời. Sử dụng khi:
- Học sinh nói "dễ", "khó", "nhớ rồi", "quên mất"
- Học sinh đánh giá kết quả ôn tập
- Cập nhật SRS interval cho từ vựng
Rating: 1=again (quên), 2=hard (khó), 3=good (ok), 4=easy (dễ)`,
      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
        termId: z.string().describe('ID của từ vựng (cardId)'),
        rating: z
          .number()
          .min(1)
          .max(4)
          .describe('Đánh giá: 1=again, 2=hard, 3=good, 4=easy'),
      }),
      func: async ({ userId, termId, rating }) => {
        try {
          this.logger.log(
            `Updating progress: user=${userId}, term=${termId}, rating=${rating}`,
          );

          // Get current progress or create new
          let progress = await this.prisma.userVocabularyProgress.findUnique({
            where: {
              userId_termId: { userId, termId },
            },
          });

          const now = new Date();

          if (!progress) {
            // Create new progress for new card
            progress = await this.prisma.userVocabularyProgress.create({
              data: {
                userId,
                termId,
                easeFactor: 2.5,
                interval: 1,
                repetitions: 0,
                correctCount: 0,
                wrongCount: 0,
                status: 'learning',
                lastReviewAt: now,
                nextReviewAt: this.calculateNextReview(now, 1),
              },
            });
          }

          // Apply SM-2 algorithm
          const result = this.applySM2(progress, rating);

          // Update progress
          const updatedProgress =
            await this.prisma.userVocabularyProgress.update({
              where: {
                userId_termId: { userId, termId },
              },
              data: {
                easeFactor: result.easeFactor,
                interval: result.interval,
                repetitions: result.repetitions,
                correctCount:
                  rating >= 3
                    ? progress.correctCount + 1
                    : progress.correctCount,
                wrongCount:
                  rating < 3 ? progress.wrongCount + 1 : progress.wrongCount,
                status: result.status,
                lastReviewAt: now,
                nextReviewAt: result.nextReviewAt,
              },
              include: {
                term: {
                  select: { word: true, definition: true },
                },
              },
            });

          const ratingMessages: Record<number, string> = {
            1: 'Từ này sẽ xuất hiện lại sớm để ôn tập thêm.',
            2: '💪 Cố gắng thêm! Từ này sẽ review lại sau 1 ngày.',
            3: '👍 Tốt lắm! Tiếp tục phát huy!',
            4: '🌟 Xuất sắc! Bạn đã thuộc từ này rồi!',
          };

          return JSON.stringify({
            success: true,
            message: ratingMessages[rating],
            updatedProgress: {
              word: updatedProgress.term.word,
              status: result.status,
              nextReviewIn: this.formatInterval(result.interval),
              nextReviewAt: result.nextReviewAt.toISOString(),
              streak: result.repetitions,
              totalCorrect: updatedProgress.correctCount,
              totalWrong: updatedProgress.wrongCount,
            },
          });
        } catch (error) {
          this.logger.error('Error updating progress:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể cập nhật tiến độ. Vui lòng thử lại.',
          });
        }
      },
    });
  }

  /**
   * Tool 3: Thống kê tiến độ ôn tập từ vựng
   */
  private getVocabStatsTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_vocab_stats',
      description: `Lấy thống kê tiến độ học từ vựng của học sinh. Sử dụng khi:
- "tiến độ từ vựng", "đã học bao nhiêu từ"
- "thống kê flashcard", "review stats"
- "từ nào khó nhất", "từ nào thuộc rồi"`,
      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
        listId: z.string().optional().describe('ID vocabulary list (optional)'),
      }),
      func: async ({ userId, listId }) => {
        try {
          this.logger.log(`Getting vocab stats for user: ${userId}`);

          const whereClause: any = { userId };
          if (listId) {
            whereClause.term = { unit: { listId } };
          }

          // Get all progress
          const allProgress =
            await this.prisma.userVocabularyProgress.findMany({
              where: whereClause,
              include: {
                term: {
                  select: {
                    id: true,
                    word: true,
                    difficulty: true,
                    unit: {
                      select: {
                        list: { select: { id: true, title: true } },
                      },
                    },
                  },
                },
              },
            });

          // Count by status
          const byStatus = {
            new: allProgress.filter((p) => p.status === 'new').length,
            learning: allProgress.filter((p) => p.status === 'learning').length,
            review: allProgress.filter((p) => p.status === 'review').length,
            mastered: allProgress.filter((p) => p.status === 'mastered').length,
          };

          // Due today
          const now = new Date();
          const dueToday = allProgress.filter(
            (p) => p.nextReviewAt <= now,
          ).length;

          // Total correct/wrong
          const totalCorrect = allProgress.reduce(
            (sum, p) => sum + p.correctCount,
            0,
          );
          const totalWrong = allProgress.reduce(
            (sum, p) => sum + p.wrongCount,
            0,
          );
          const accuracy =
            totalCorrect + totalWrong > 0
              ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
              : 0;

          // Hardest words (lowest ease factor)
          const hardestWords = allProgress
            .filter((p) => p.wrongCount > 0)
            .sort((a, b) => a.easeFactor - b.easeFactor)
            .slice(0, 5)
            .map((p) => ({
              word: p.term.word,
              wrongCount: p.wrongCount,
              correctCount: p.correctCount,
            }));

          // Best words (highest repetitions)
          const bestWords = allProgress
            .filter((p) => p.status === 'mastered' || p.repetitions >= 3)
            .sort((a, b) => b.repetitions - a.repetitions)
            .slice(0, 5)
            .map((p) => ({
              word: p.term.word,
              streak: p.repetitions,
            }));

          // Lists summary
          const listMap = new Map<
            string,
            { title: string; learned: number; total: number }
          >();
          allProgress.forEach((p) => {
            const listId = p.term.unit?.list?.id;
            const listTitle = p.term.unit?.list?.title || 'Unknown';
            if (listId) {
              if (!listMap.has(listId)) {
                listMap.set(listId, { title: listTitle, learned: 0, total: 0 });
              }
              const data = listMap.get(listId)!;
              data.total++;
              if (p.status === 'mastered' || p.status === 'review') {
                data.learned++;
              }
            }
          });

          // Study streak (days with review activity)
          const last7Days = await this.getStudyStreak(userId);

          return JSON.stringify({
            success: true,
            stats: {
              totalWords: allProgress.length,
              byStatus,
              dueToday,
              accuracy: `${accuracy}%`,
              totalReviews: totalCorrect + totalWrong,
              studyStreak: last7Days,
            },
            hardestWords,
            bestWords,
            listProgress: Array.from(listMap.values()),
            motivation: this.getMotivation(byStatus, accuracy),
          });
        } catch (error) {
          this.logger.error('Error getting vocab stats:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể lấy thống kê. Vui lòng thử lại.',
          });
        }
      },
    });
  }

  /**
   * Tool 4: Lấy từ mới để học
   */
  private getNewCardsTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_new_vocab_cards',
      description: `Lấy từ vựng mới chưa học để bắt đầu học. Sử dụng khi:
- "học từ mới", "thêm từ vựng"
- "gợi ý từ vựng", "từ nào hay"
- "bắt đầu học list mới"`,
      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
        listId: z.string().optional().describe('ID vocabulary list'),
        difficulty: z
          .enum(['beginner', 'intermediate', 'advanced', 'all'])
          .optional()
          .default('all')
          .describe('Độ khó'),
        limit: z.number().optional().default(5).describe('Số lượng từ'),
      }),
      func: async ({ userId, listId, difficulty = 'all', limit = 5 }) => {
        try {
          // Get user's lists
          const userLists = await this.prisma.userVocabularyList.findMany({
            where: {
              userId,
              ...(listId && { listId }),
            },
            include: {
              list: {
                select: { id: true, title: true, difficulty: true },
              },
            },
          });

          if (userLists.length === 0) {
            // Suggest public lists
            const publicLists = await this.prisma.vocabularyList.findMany({
              where: {
                isPublic: true,
                ...(difficulty !== 'all' && { difficulty }),
              },
              select: {
                id: true,
                title: true,
                description: true,
                difficulty: true,
                totalTerms: true,
              },
              take: 5,
              orderBy: { userCount: 'desc' },
            });

            return JSON.stringify({
              success: true,
              message:
                'Bạn chưa thêm vocabulary list nào. Đây là một số list phổ biến:',
              suggestedLists: publicLists,
              action:
                'Thêm list vào danh sách học của bạn để bắt đầu học từ mới.',
            });
          }

          // Get terms user hasn't learned yet
          const existingTermIds = (
            await this.prisma.userVocabularyProgress.findMany({
              where: { userId },
              select: { termId: true },
            })
          ).map((p) => p.termId);

          const listIds = userLists.map((ul) => ul.listId);

          const newTerms = await this.prisma.vocabularyTerm.findMany({
            where: {
              unit: { listId: { in: listIds } },
              id: { notIn: existingTermIds },
              ...(difficulty !== 'all' && { difficulty }),
            },
            include: {
              unit: {
                include: {
                  list: { select: { title: true } },
                },
              },
            },
            take: limit,
            orderBy: { orderIndex: 'asc' },
          });

          if (newTerms.length === 0) {
            return JSON.stringify({
              success: true,
              message:
                'Bạn đã học hết tất cả từ trong các list! Thêm list mới để tiếp tục.',
              cards: [],
            });
          }

          const cards = newTerms.map((term) => ({
            cardId: term.id,
            word: term.word,
            definition: term.definition,
            pronunciation: term.pronunciation,
            translationVi: term.translationVi,
            examples: term.examples,
            difficulty: term.difficulty,
            listTitle: term.unit?.list?.title,
          }));

          return JSON.stringify({
            success: true,
            message: `Có ${cards.length} từ mới để học!`,
            cards,
            tip: 'Sau khi học xong, dùng tool **update_flashcard_progress** với rating=3 hoặc 4 để đánh dấu đã học.',
          });
        } catch (error) {
          this.logger.error('Error getting new cards:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể lấy từ mới. Vui lòng thử lại.',
          });
        }
      },
    });
  }

  /**
   * Tool 5: Xem tổng quan vocabulary list
   */
  private getListSummaryTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_vocab_list_summary',
      description: `Xem tổng quan các vocabulary list của học sinh. Sử dụng khi:
- "list từ vựng của tôi", "đang học list nào"
- "tiến độ vocabulary list"
- "list nào chưa học xong"`,
      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
      }),
      func: async ({ userId }) => {
        try {
          const userLists = await this.prisma.userVocabularyList.findMany({
            where: { userId },
            include: {
              list: {
                include: {
                  units: {
                    include: {
                      terms: {
                        select: { id: true },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { lastStudiedAt: 'desc' },
          });

          if (userLists.length === 0) {
            return JSON.stringify({
              success: true,
              message: 'Bạn chưa thêm vocabulary list nào vào danh sách học.',
              lists: [],
              suggestion:
                'Dùng tool **get_new_vocab_cards** để xem các list gợi ý.',
            });
          }

          // Get user's progress for each list
          const progress = await this.prisma.userVocabularyProgress.findMany({
            where: { userId },
            select: {
              termId: true,
              status: true,
              term: {
                select: {
                  unit: { select: { listId: true } },
                },
              },
            },
          });

          // Map progress by listId
          const progressByList = new Map<
            string,
            { learned: number; mastered: number }
          >();
          progress.forEach((p) => {
            const listId = p.term.unit?.listId;
            if (listId) {
              if (!progressByList.has(listId)) {
                progressByList.set(listId, { learned: 0, mastered: 0 });
              }
              const data = progressByList.get(listId)!;
              data.learned++;
              if (p.status === 'mastered') {
                data.mastered++;
              }
            }
          });

          const lists = userLists.map((ul) => {
            const totalTerms = ul.list.units.reduce(
              (sum, u) => sum + u.terms.length,
              0,
            );
            const listProgress = progressByList.get(ul.listId) || {
              learned: 0,
              mastered: 0,
            };
            const progressPercent =
              totalTerms > 0
                ? Math.round((listProgress.learned / totalTerms) * 100)
                : 0;

            return {
              listId: ul.listId,
              title: ul.list.title,
              description: ul.list.description,
              difficulty: ul.list.difficulty,
              totalTerms,
              learned: listProgress.learned,
              mastered: listProgress.mastered,
              progressPercent,
              lastStudiedAt: ul.lastStudiedAt,
              addedAt: ul.addedAt,
            };
          });

          return JSON.stringify({
            success: true,
            totalLists: lists.length,
            lists,
            summary: {
              totalWords: lists.reduce((sum, l) => sum + l.totalTerms, 0),
              totalLearned: lists.reduce((sum, l) => sum + l.learned, 0),
              totalMastered: lists.reduce((sum, l) => sum + l.mastered, 0),
            },
          });
        } catch (error) {
          this.logger.error('Error getting list summary:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể lấy thông tin. Vui lòng thử lại.',
          });
        }
      },
    });
  }

  // ==================== Helper Methods ====================

  /**
   * SM-2 Algorithm implementation
   */
  private applySM2(
    progress: any,
    rating: number,
  ): {
    easeFactor: number;
    interval: number;
    repetitions: number;
    status: string;
    nextReviewAt: Date;
  } {
    let { easeFactor, interval, repetitions } = progress;
    const now = new Date();

    // Rating: 1=again, 2=hard, 3=good, 4=easy
    if (rating < 3) {
      // Wrong answer - reset
      repetitions = 0;
      interval = 1;
    } else {
      // Correct answer
      repetitions++;

      if (repetitions === 1) {
        interval = 1;
      } else if (repetitions === 2) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }

      // Adjust ease factor based on rating
      // EF' = EF + (0.1 - (5-q)*(0.08+(5-q)*0.02))
      const q = rating + 1; // Convert 1-4 to 2-5
      easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
      easeFactor = Math.max(1.3, easeFactor); // Minimum 1.3
    }

    // Determine status
    let status = 'learning';
    if (repetitions >= 5) {
      status = 'mastered';
    } else if (repetitions >= 2) {
      status = 'review';
    } else if (repetitions >= 1) {
      status = 'learning';
    } else {
      status = 'new';
    }

    // Calculate next review date
    const nextReviewAt = new Date(now);
    nextReviewAt.setDate(nextReviewAt.getDate() + interval);

    return {
      easeFactor: Math.round(easeFactor * 100) / 100,
      interval,
      repetitions,
      status,
      nextReviewAt,
    };
  }

  private calculateNextReview(date: Date, intervalDays: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + intervalDays);
    return next;
  }

  private formatInterval(days: number): string {
    if (days === 0) return 'ngay bây giờ';
    if (days === 1) return '1 ngày';
    if (days < 7) return `${days} ngày`;
    if (days < 30) return `${Math.round(days / 7)} tuần`;
    return `${Math.round(days / 30)} tháng`;
  }

  private async getNextReviewTime(userId: string): Promise<string> {
    const nextReview = await this.prisma.userVocabularyProgress.findFirst({
      where: { userId },
      orderBy: { nextReviewAt: 'asc' },
      select: { nextReviewAt: true },
    });

    if (!nextReview) return 'Không có từ nào';

    const now = new Date();
    const diff = nextReview.nextReviewAt.getTime() - now.getTime();
    const hours = Math.round(diff / (1000 * 60 * 60));

    if (hours <= 0) return 'Ngay bây giờ';
    if (hours < 24) return `${hours} giờ nữa`;
    return `${Math.round(hours / 24)} ngày nữa`;
  }

  private async getStudyStreak(userId: string): Promise<number> {
    const reviews = await this.prisma.userVocabularyProgress.findMany({
      where: { userId },
      select: { lastReviewAt: true },
      orderBy: { lastReviewAt: 'desc' },
    });

    if (reviews.length === 0) return 0;

    const uniqueDays = new Set<string>();
    reviews.forEach((r) => {
      uniqueDays.add(r.lastReviewAt.toISOString().split('T')[0]);
    });

    // Count consecutive days from today
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      if (uniqueDays.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  }

  private getMotivation(
    byStatus: Record<string, number>,
    accuracy: number,
  ): string {
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const masteredPercent =
      total > 0 ? (byStatus.mastered / total) * 100 : 0;

    if (masteredPercent >= 80) {
      return '🏆 Xuất sắc! Bạn đã thuộc hầu hết từ vựng!';
    } else if (masteredPercent >= 50) {
      return '💪 Tốt lắm! Tiếp tục cố gắng để thuộc hết từ!';
    } else if (accuracy >= 70) {
      return '👍 Độ chính xác tốt! Hãy ôn tập đều đặn mỗi ngày.';
    } else if (total > 0) {
      return 'Hãy dành thời gian ôn tập mỗi ngày để cải thiện!';
    }
    return '🌟 Bắt đầu học từ vựng ngay hôm nay!';
  }
}
