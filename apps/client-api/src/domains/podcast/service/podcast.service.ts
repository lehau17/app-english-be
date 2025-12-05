import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    CreatePodcastDto,
    GetPodcastsQueryDto,
    GetUserAttemptsQueryDto,
    UpdatePodcastDto,
    UpdatePodcastGapDto,
} from '../dto/podcast.dto';
import {
    CreateRatingDto,
    GetRatingsQueryDto,
} from '../dto/user-interaction.dto';
import { PodcastRepository } from '../repository/podcast.repository';

@Injectable()
export class PodcastService {
  constructor(
    private readonly prisma: PrismaRepository,
    private readonly podcastRepository: PodcastRepository,
  ) {}

  // ===================== PODCAST CRUD =====================

  async findAll(userId: string, query: GetPodcastsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.podcastRepository.findAll(
      userId,
      query,
    );

    return PageResponseDto.of(items as any, page, limit, total);
  }

  async getPodcastById(id: string) {
    const podcast = await this.podcastRepository.findById(id);
    if (!podcast) throw new NotFoundException('Podcast not found');
    return podcast;
  }

  async createPodcast(dto: CreatePodcastDto, authorId: string) {
    // Validate mediaType and URL
    if (dto.mediaType === 'audio' && !dto.audioUrl) {
      throw new BadRequestException(
        'audioUrl is required when mediaType is audio',
      );
    }

    if (dto.mediaType === 'video' && !dto.videoUrl) {
      throw new BadRequestException(
        'videoUrl is required when mediaType is video',
      );
    }

    // Generate code from title
    const code =
      dto.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    // Determine gaps to create
    const gapsToCreate = (dto.gaps ?? []).map((g) => ({
      startIndex: g.startIndex,
      endIndex: g.endIndex,
      answer: g.answer,
      orderNo: g.orderNo || 1,
    }));

    return this.podcastRepository.createPodcast({
      code,
      title: dto.title,
      description: dto.description,
      audioUrl: dto.audioUrl,
      videoUrl: dto.videoUrl,
      mediaType: dto.mediaType,
      thumbnailUrl: dto.thumbnailUrl,
      transcript: dto.content,
      category: dto.category,
      difficulty: dto.difficulty,
      duration: dto.duration ?? 0,
      author: { connect: { id: authorId } },
      gaps: gapsToCreate.length > 0 ? { create: gapsToCreate } : undefined,
    });
  }

  // Helper method to extract blanks from content format: [word]
  private extractBlanksFromContent(content: string): Array<{
    sentence: string;
    word: string;
    startIndex: number;
    endIndex: number;
  }> {
    const blanks: Array<{
      sentence: string;
      word: string;
      startIndex: number;
      endIndex: number;
    }> = [];
    const regex = /\[([^\]]+)\]/g;
    let match;

    // Process entire content to find [word] patterns
    const processedContent = content;

    while ((match = regex.exec(processedContent)) !== null) {
      const word = match[1];
      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;

      // Find the sentence containing this match
      const beforeMatch = processedContent.substring(0, matchStart);
      const afterMatch = processedContent.substring(matchEnd);

      // Simple sentence extraction (could be improved)
      const sentenceStart =
        Math.max(
          beforeMatch.lastIndexOf('.'),
          beforeMatch.lastIndexOf('!'),
          beforeMatch.lastIndexOf('?'),
        ) + 1;

      const nextSentenceEnd = Math.min(
        afterMatch.indexOf('.') !== -1
          ? afterMatch.indexOf('.') + matchEnd
          : Infinity,
        afterMatch.indexOf('!') !== -1
          ? afterMatch.indexOf('!') + matchEnd
          : Infinity,
        afterMatch.indexOf('?') !== -1
          ? afterMatch.indexOf('?') + matchEnd
          : Infinity,
      );

      const sentenceEnd =
        nextSentenceEnd === Infinity
          ? processedContent.length
          : nextSentenceEnd + 1;

      const fullSentence = processedContent
        .substring(sentenceStart, sentenceEnd)
        .trim();
      const sentenceWithBlank = fullSentence.replace(`[${word}]`, '___');

      blanks.push({
        sentence: sentenceWithBlank,
        word: word,
        startIndex: matchStart,
        endIndex: matchEnd - 1,
      });
    }

    return blanks;
  }

  async update(id: string, updatePodcastDto: UpdatePodcastDto, userId: string) {
    const podcast = await this.podcastRepository.findById(id);

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    if (podcast.authorId !== userId) {
      throw new ForbiddenException('You can only update your own podcasts');
    }

    // Process gaps if provided
    if (updatePodcastDto.gaps !== undefined) {
      await this.updateGaps(id, updatePodcastDto.gaps, podcast.transcript);
    }

    // Remove gaps from DTO before passing to repository (handled separately)
    const { gaps, ...updateData } = updatePodcastDto;

    return this.podcastRepository.updatePodcast(id, updateData);
  }

  private async updateGaps(
    podcastId: string,
    gaps: UpdatePodcastGapDto[],
    transcript: string,
  ): Promise<void> {
    // Validate transcript exists
    if (!transcript) {
      throw new BadRequestException(
        'Transcript is required to update gaps',
      );
    }

    const transcriptLength = transcript.length;

    // Validate all gaps before processing
    for (const gap of gaps) {
      if (gap.startIndex < 0 || gap.endIndex < 0) {
        throw new BadRequestException(
          `Gap indices must be non-negative: startIndex=${gap.startIndex}, endIndex=${gap.endIndex}`,
        );
      }

      if (gap.startIndex >= gap.endIndex) {
        throw new BadRequestException(
          `startIndex must be less than endIndex: startIndex=${gap.startIndex}, endIndex=${gap.endIndex}`,
        );
      }

      if (gap.endIndex > transcriptLength) {
        throw new BadRequestException(
          `Gap endIndex (${gap.endIndex}) exceeds transcript length (${transcriptLength})`,
        );
      }

      if (!gap.answer || gap.answer.trim().length === 0) {
        throw new BadRequestException('Gap answer cannot be empty');
      }

      // Validate answer matches transcript substring
      const transcriptAnswer = transcript.substring(
        gap.startIndex,
        gap.endIndex,
      );
      if (transcriptAnswer.trim().toLowerCase() !== gap.answer.trim().toLowerCase()) {
        throw new BadRequestException(
          `Gap answer "${gap.answer}" does not match transcript at position ${gap.startIndex}-${gap.endIndex}: "${transcriptAnswer}"`,
        );
      }
    }

    // Fetch existing gaps
    const existingGaps = await this.prisma.podcastGap.findMany({
      where: { podcastId },
    });

    // Identify gaps to create, update, and delete
    const gapsToCreate: UpdatePodcastGapDto[] = [];
    const gapsToUpdate: UpdatePodcastGapDto[] = [];
    const existingGapIds = new Set(existingGaps.map((g) => g.id));
    const newGapIds = new Set(
      gaps.filter((g) => g.id).map((g) => g.id as string),
    );

    for (const gap of gaps) {
      if (gap.id && existingGapIds.has(gap.id)) {
        gapsToUpdate.push(gap);
      } else if (!gap.id) {
        gapsToCreate.push(gap);
      }
    }

    const gapsToDelete = existingGaps.filter(
      (g) => !newGapIds.has(g.id),
    );

    // Execute in transaction
    await this.prisma.$transaction(async (tx) => {
      // Delete removed gaps
      if (gapsToDelete.length > 0) {
        await tx.podcastGap.deleteMany({
          where: {
            id: { in: gapsToDelete.map((g) => g.id) },
          },
        });
      }

      // Update existing gaps
      for (const gap of gapsToUpdate) {
        await tx.podcastGap.update({
          where: { id: gap.id },
          data: {
            startIndex: gap.startIndex,
            endIndex: gap.endIndex,
            answer: gap.answer.trim(),
            orderNo: gap.orderNo ?? 1,
          },
        });
      }

      // Create new gaps
      if (gapsToCreate.length > 0) {
        await tx.podcastGap.createMany({
          data: gapsToCreate.map((gap) => ({
            podcastId,
            startIndex: gap.startIndex,
            endIndex: gap.endIndex,
            answer: gap.answer.trim(),
            orderNo: gap.orderNo ?? gaps.length + 1,
          })),
        });
      }
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const podcast = await this.podcastRepository.findById(id);

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    if (podcast.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own podcasts');
    }

    await this.podcastRepository.deletePodcast(id);
  }

  async createRating(
    podcastId: string,
    userId: string,
    createRatingDto: CreateRatingDto,
  ) {
    const podcast = await this.podcastRepository.findById(podcastId);

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    const rating = await this.podcastRepository.upsertRating({
      where: {
        userId_podcastId: {
          userId,
          podcastId,
        },
      },
      update: {
        overallRating: createRatingDto.overallRating,
        difficultyRating: createRatingDto.difficultyRating ?? 3,
        qualityRating: createRatingDto.qualityRating ?? 3,
        comment: createRatingDto.review,
        title: createRatingDto.title,
      },
      create: {
        overallRating: createRatingDto.overallRating,
        difficultyRating: createRatingDto.difficultyRating ?? 0,
        qualityRating: createRatingDto.qualityRating ?? 0,
        comment: createRatingDto.review,
        title: createRatingDto.title,
        user: { connect: { id: userId } },
        podcast: { connect: { id: podcastId } },
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    await this.updatePodcastRatingsCache(podcastId);

    return rating;
  }

  async getRatings(podcastId: string, query: GetRatingsQueryDto) {
    const { page = 1, limit = 10, sortBy = 'newest' } = query;
    const skip = (page - 1) * limit;

    let orderBy: any = {};
    switch (sortBy) {
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'rating':
        orderBy = { overallRating: 'desc' };
        break;
      case 'helpful':
        orderBy = { helpfulCount: 'desc' };
        break;
    }

    const [ratings, total] = await Promise.all([
      this.podcastRepository.listRatings({
        where: { podcastId },
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.podcastRepository.countRatings(podcastId),
    ]);

    return PageResponseDto.of(ratings as any, page, limit, total);
  }

  private async updatePodcastRatingsCache(podcastId: string) {
    const stats =
      await this.podcastRepository.aggregatePodcastRating(podcastId);

    await this.podcastRepository.updatePodcast(podcastId, {
      averageRating: stats._avg.overallRating,
      difficultyRating: stats._avg.difficultyRating,
      qualityRating: stats._avg.qualityRating,
      totalRatings: stats._count?._all ?? 0,
    });
  }

  async startPodcastAttempt(podcastId: string, userId: string) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
      include: { gaps: { orderBy: { orderNo: 'asc' } } },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    // Mask transcript
    let transcriptMasked = podcast.transcript;
    podcast.gaps.forEach((gap) => {
      const hidden = '_'.repeat(gap.answer.length);
      transcriptMasked =
        transcriptMasked.substring(0, gap.startIndex) +
        hidden +
        transcriptMasked.substring(gap.endIndex);
    });

    let attempt = await this.prisma.podcastAttempt.findFirst({
      where: { podcastId, userId, status: 'in_progress' },
      orderBy: { createdAt: 'desc' },
    });

    if (!attempt) {
      const lastAttempt = await this.prisma.podcastAttempt.findFirst({
        where: { podcastId, userId },
        orderBy: { attemptNo: 'desc' },
      });

      const nextAttemptNo = lastAttempt ? lastAttempt.attemptNo + 1 : 1;

      attempt = await this.prisma.podcastAttempt.create({
        data: {
          podcast: {
            connect: { id: podcastId },
          },
          user: {
            connect: { id: userId },
          },
          attemptNo: nextAttemptNo,
          status: 'in_progress',
          answers: [],
        },
      });
    }

    return {
      podcastId: podcast.id,
      title: podcast.title,
      transcriptMasked,
      gaps: podcast.gaps.map((g) => ({
        id: g.id,
        orderNo: g.orderNo,
        startIndex: g.startIndex,
        endIndex: g.endIndex,
        length: g.answer.length,
      })),
      attemptId: attempt.id,
      attemptNo: attempt.attemptNo,
      timeSpent: attempt.timeSpent || 0,
      answers: attempt.answers,
      status: attempt.status,
      metadata: {
        duration: podcast.duration,
        difficulty: podcast.difficulty,
        authorId: podcast.authorId,
      },
    };
  }

  async submitPodcastAttempt(
    podcastId: string,
    attemptId: string,
    answers: Record<string, string>, // { gapId: answer }
  ) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
      include: { gaps: true },
    });
    if (!podcast) throw new NotFoundException('Podcast not found');

    const attempt = await this.prisma.podcastAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    // Chấm điểm
    let correctCount = 0;
    podcast.gaps.forEach((gap) => {
      const userAns = answers[gap.id]?.trim().toLowerCase();
      const correctAns = gap.answer.trim().toLowerCase();
      if (userAns === correctAns) correctCount++;
    });

    const totalQuestions = podcast.gaps.length;
    const scorePercent = totalQuestions
      ? Math.round((correctCount / totalQuestions) * 100)
      : 0;

    // Update attempt
    const updated = await this.prisma.podcastAttempt.update({
      where: { id: attemptId },
      data: {
        correctCount,
        totalQuestions,
        scorePercent,
        answers,
        status: 'submitted',
      },
    });

    return {
      attemptId: updated.id,
      podcastId: podcast.id,
      scorePercent,
      correctCount,
      totalQuestions,
      status: updated.status,
    };
  }

  async saveDraft(
    podcastId: string,
    attemptId: string,
    answers: Record<string, string>,
    timeSpent?: number,
  ) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
    });
    if (!podcast) throw new NotFoundException('Podcast not found');
    const attempt = await this.prisma.podcastAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    if (attempt.status !== 'in_progress') {
      throw new BadRequestException(
        'Cannot save draft for a submitted/completed attempt',
      );
    }

    const updated = await this.prisma.podcastAttempt.update({
      where: { id: attemptId },
      data: {
        answers,
        timeSpent: timeSpent,
      },
    });

    return {
      attemptId: updated.id,
      podcastId,
      status: updated.status,
      savedAnswers: updated.answers,
    };
  }

  async getPodcastAttempts(podcastId: string, userId: string) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
    });
    if (!podcast) throw new NotFoundException('Podcast not found');

    const attempts = await this.prisma.podcastAttempt.findMany({
      where: { podcastId, userId },
      orderBy: { createdAt: 'desc' },
    });

    return attempts.map((a) => ({
      attemptId: a.id,
      attemptNo: a.attemptNo,
      status: a.status,
      scorePercent: a.scorePercent,
      correctCount: a.correctCount,
      totalQuestions: a.totalQuestions,
      timeSpent: a.timeSpent,
      createdAt: a.createdAt,
      answers: a.answers,
    }));
  }

  // ===================== USER ATTEMPTS HISTORY =====================

  async getAllUserAttempts(userId: string, query: GetUserAttemptsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.status) {
      where.status = query.status;
    }

    const [attempts, total] = await Promise.all([
      this.prisma.podcastAttempt.findMany({
        where,
        include: {
          podcast: {
            select: {
              id: true,
              title: true,
              category: true,
              difficulty: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.podcastAttempt.count({ where }),
    ]);

    const data = attempts.map((a) => ({
      attemptId: a.id,
      attemptNo: a.attemptNo,
      podcastId: a.podcastId,
      podcast: a.podcast,
      status: a.status,
      scorePercent: a.scorePercent,
      correctCount: a.correctCount,
      totalQuestions: a.totalQuestions,
      timeSpent: a.timeSpent,
      createdAt: a.createdAt,
      answers: a.answers,
    }));

    return PageResponseDto.of(data, page, limit, total);
  }
}
