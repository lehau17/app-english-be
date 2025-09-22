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
  UpdatePodcastDto,
} from '../dto/podcast.dto';
import {
  CreateRatingDto,
  GetRatingsQueryDto,
} from '../dto/user-interaction.dto';

@Injectable()
export class PodcastService {
  constructor(private readonly prisma: PrismaRepository) {}

  // ===================== PODCAST CRUD =====================

  async findAll(userId: string, query: GetPodcastsQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      source,
      difficulty,
      duration,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      recommended,
      premium,
      tab,
    } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    // Search
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { transcript: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filters
    if (category) where.category = category;
    if (source) where.source = source;
    if (difficulty) where.difficulty = difficulty;
    if (recommended !== undefined) where.isRecommended = recommended;
    if (premium !== undefined) where.isPremium = premium;

    // Duration filter
    if (duration) {
      switch (duration) {
        case 'short':
          where.duration = { lt: 600 }; // < 10 minutes
          break;
        case 'medium':
          where.duration = { gte: 600, lte: 1200 }; // 10-20 minutes
          break;
        case 'long':
          where.duration = { gt: 1200 }; // > 20 minutes
          break;
      }
    }

    // Tab filtering with user progress
    if (tab && userId) {
      switch (tab) {
        case 'listening':
          where.userProgress = {
            some: {
              userId,
              isCompleted: false,
              completionRate: { gt: 0 },
            },
          };
          break;
        case 'completed':
          where.userProgress = {
            some: {
              userId,
              isCompleted: true,
            },
          };
          break;
        case 'recommended':
          where.isRecommended = true;
          break;
      }
    }

    // Sorting
    let orderBy: any = {};
    switch (sortBy) {
      case 'newest':
        orderBy = { createdAt: sortOrder };
        break;
      case 'popular':
        orderBy = { viewCount: sortOrder };
        break;
      case 'duration':
        orderBy = { duration: sortOrder };
        break;
      case 'rating':
        orderBy = { averageRating: sortOrder };
        break;
      case 'title':
        orderBy = { title: sortOrder };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [podcasts, total] = await Promise.all([
      this.prisma.podcast.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.podcast.count({ where }),
    ]);

    // Transform response
    const transformedPodcasts = podcasts.map((podcast) => ({
      ...podcast,
    }));

    return PageResponseDto.of(transformedPodcasts as any, page, limit, total);
  }

  async getPodcastById(id: string) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id },
      include: { gaps: true },
    });
    if (!podcast) throw new NotFoundException('Podcast not found');
    return podcast;
  }

  async createPodcast(dto: CreatePodcastDto, authorId: string) {
    // Generate code from title
    const code =
      dto.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    // Create base podcast data
    const podcastData = {
      code,
      title: dto.title,
      description: dto.description,
      audioUrl: dto.audioUrl,
      thumbnailUrl: dto.thumbnailUrl,
      transcript: dto.content, // Use unified content as transcript
      category: dto.category,
      difficulty: dto.difficulty,
      duration: dto.duration,
      authorId: authorId,
    };

    // Determine gaps to create
    let gapsToCreate: any[] = [];

    if (dto.gaps && dto.gaps.length > 0) {
      // Use provided gaps
      gapsToCreate = dto.gaps.map((g: any) => ({
        startIndex: g.startIndex,
        endIndex: g.endIndex,
        answer: g.answer,
        orderNo: g.orderNo || 1,
      }));
    }
    // Create podcast with gaps and fillBlankContent
    return this.prisma.podcast.create({
      data: {
        ...podcastData,
        gaps: gapsToCreate.length > 0 ? { create: gapsToCreate } : undefined,
      },
      include: {
        gaps: true,
        author: { select: { id: true, firstName: true, lastName: true } },
      },
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
    const currentIndex = 0;

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
    const podcast = await this.prisma.podcast.findUnique({
      where: { id },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    if (podcast.authorId !== userId) {
      throw new ForbiddenException('You can only update your own podcasts');
    }

    const updatedPodcast = await this.prisma.podcast.update({
      where: { id },
      data: updatePodcastDto,
    });

    return updatedPodcast;
  }

  async remove(id: string, userId: string): Promise<void> {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    if (podcast.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own podcasts');
    }

    await this.prisma.podcast.delete({
      where: { id },
    });
  }

  async createRating(
    podcastId: string,
    userId: string,
    createRatingDto: CreateRatingDto,
  ) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    const rating = await this.prisma.podcastRating.upsert({
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
        user: {
          connect: { id: userId },
        },
        podcast: {
          connect: { id: podcastId },
        },
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

    // Update podcast ratings cache
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
      this.prisma.podcastRating.findMany({
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
      this.prisma.podcastRating.count({ where: { podcastId } }),
    ]);

    return PageResponseDto.of(ratings as any, page, limit, total);
  }

  private async updatePodcastRatingsCache(podcastId: string) {
    const stats = await this.prisma.podcastRating.aggregate({
      where: { podcastId },
      _avg: {
        overallRating: true,
        difficultyRating: true,
        qualityRating: true,
      },
      _count: {
        id: true,
      },
    });

    await this.prisma.podcast.update({
      where: { id: podcastId },
      data: {
        averageRating: stats._avg.overallRating,
        difficultyRating: stats._avg.difficultyRating,
        qualityRating: stats._avg.qualityRating,
        totalRatings: stats._count.id,
      },
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
}
