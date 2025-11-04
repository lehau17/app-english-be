import { PodcastService } from './podcast.service';
import { PodcastRepository } from '../repository/podcast.repository';
import { PrismaRepository } from '@app/database';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PodcastCategory, PodcastDifficulty } from '@prisma/client';

// Minimal mock implementations for dependencies
const makeMocks = () => {
  const prisma: any = {
    podcast: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    podcastRating: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    podcastAttempt: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const podcastRepository: any = {
    findAll: jest.fn(),
    findById: jest.fn(),
    createPodcast: jest.fn(),
    updatePodcast: jest.fn(),
    deletePodcast: jest.fn(),
    upsertRating: jest.fn(),
    listRatings: jest.fn(),
    countRatings: jest.fn(),
    aggregatePodcastRating: jest.fn(),
    createAttempt: jest.fn(),
    findAttemptById: jest.fn(),
    updateAttempt: jest.fn(),
    listAttempts: jest.fn(),
  };

  return { prisma, podcastRepository };
};

describe('PodcastService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('findAll', () => {
    test('should return paginated podcasts', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcasts = [
        {
          id: 'podcast-1',
          title: 'Test Podcast 1',
          category: PodcastCategory.daily_conversation,
          difficulty: PodcastDifficulty.beginner,
        },
        {
          id: 'podcast-2',
          title: 'Test Podcast 2',
          category: PodcastCategory.business,
          difficulty: PodcastDifficulty.intermediate,
        },
      ];

      podcastRepository.findAll.mockResolvedValue({
        items: mockPodcasts,
        total: 2,
      });

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      const result = await service.findAll('user-1', { page: 1, limit: 20 });

      expect(result).toBeDefined();
      expect(result.data).toEqual(mockPodcasts);
      expect(result.totalItems).toBe(2);
      expect(podcastRepository.findAll).toHaveBeenCalledWith('user-1', {
        page: 1,
        limit: 20,
      });
    });
  });

  describe('getPodcastById', () => {
    test('should return podcast when found', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
        title: 'Test Podcast',
        description: 'Test Description',
        category: PodcastCategory.daily_conversation,
      };

      podcastRepository.findById.mockResolvedValue(mockPodcast);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      const result = await service.getPodcastById('podcast-1');

      expect(result).toEqual(mockPodcast);
      expect(podcastRepository.findById).toHaveBeenCalledWith('podcast-1');
    });

    test('should throw NotFoundException when podcast not found', async () => {
      const { prisma, podcastRepository } = makeMocks();

      podcastRepository.findById.mockResolvedValue(null);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      await expect(service.getPodcastById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createPodcast', () => {
    test('should create podcast with gaps', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const createDto = {
        title: 'New Podcast',
        description: 'Test Description',
        content: 'This is the transcript',
        audioUrl: 'http://example.com/audio.mp3',
        thumbnailUrl: 'http://example.com/thumb.jpg',
        category: PodcastCategory.daily_conversation,
        difficulty: PodcastDifficulty.beginner,
        audioMode: 'upload' as 'upload' | 'generate',
        duration: 300,
        gaps: [
          {
            startIndex: 0,
            endIndex: 4,
            answer: 'This',
            orderNo: 1,
          },
        ],
      };

      const mockCreatedPodcast = {
        id: 'podcast-1',
        code: 'new-podcast-123456',
        title: createDto.title,
        description: createDto.description,
        transcript: createDto.content,
        audioUrl: createDto.audioUrl,
        thumbnailUrl: createDto.thumbnailUrl,
        category: createDto.category,
        difficulty: createDto.difficulty,
        duration: createDto.duration,
        gaps: [
          {
            id: 'gap-1',
            startIndex: 0,
            endIndex: 4,
            answer: 'This',
            orderNo: 1,
          },
        ],
      };

      podcastRepository.createPodcast.mockResolvedValue(mockCreatedPodcast);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      const result = await service.createPodcast(createDto, 'author-1');

      expect(result).toEqual(mockCreatedPodcast);
      expect(podcastRepository.createPodcast).toHaveBeenCalled();

      const callArgs = podcastRepository.createPodcast.mock.calls[0][0];
      expect(callArgs.title).toBe(createDto.title);
      expect(callArgs.transcript).toBe(createDto.content);
      expect(callArgs.author).toEqual({ connect: { id: 'author-1' } });
      expect(callArgs.gaps).toEqual({
        create: [{ startIndex: 0, endIndex: 4, answer: 'This', orderNo: 1 }],
      });
    });

    test('should create podcast without gaps', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const createDto = {
        title: 'New Podcast',
        description: 'Test Description',
        content: 'This is the transcript',
        audioUrl: 'http://example.com/audio.mp3',
        category: PodcastCategory.daily_conversation,
        difficulty: PodcastDifficulty.beginner,
        audioMode: 'upload' as 'upload' | 'generate',
        duration: 300,
        gaps: [],
      };

      const mockCreatedPodcast = {
        id: 'podcast-1',
        code: 'new-podcast-123456',
        title: createDto.title,
        gaps: [],
      };

      podcastRepository.createPodcast.mockResolvedValue(mockCreatedPodcast);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      const result = await service.createPodcast(createDto, 'author-1');

      expect(result).toEqual(mockCreatedPodcast);

      const callArgs = podcastRepository.createPodcast.mock.calls[0][0];
      expect(callArgs.gaps).toBeUndefined();
    });
  });

  describe('update', () => {
    test('should update podcast when user is author', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
        title: 'Old Title',
        authorId: 'user-1',
      };

      const updateDto = {
        title: 'New Title',
        description: 'New Description',
      };

      podcastRepository.findById.mockResolvedValue(mockPodcast);
      podcastRepository.updatePodcast.mockResolvedValue({
        ...mockPodcast,
        ...updateDto,
      });

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      const result = await service.update('podcast-1', updateDto, 'user-1');

      expect(result.title).toBe('New Title');
      expect(podcastRepository.updatePodcast).toHaveBeenCalledWith(
        'podcast-1',
        updateDto,
      );
    });

    test('should throw NotFoundException when podcast not found', async () => {
      const { prisma, podcastRepository } = makeMocks();

      podcastRepository.findById.mockResolvedValue(null);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      await expect(
        service.update('podcast-1', { title: 'New' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    test('should throw ForbiddenException when user is not author', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
        title: 'Old Title',
        authorId: 'user-1',
      };

      podcastRepository.findById.mockResolvedValue(mockPodcast);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      await expect(
        service.update('podcast-1', { title: 'New' }, 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    test('should delete podcast when user is author', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
        title: 'Test Podcast',
        authorId: 'user-1',
      };

      podcastRepository.findById.mockResolvedValue(mockPodcast);
      podcastRepository.deletePodcast.mockResolvedValue(mockPodcast);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      await service.remove('podcast-1', 'user-1');

      expect(podcastRepository.deletePodcast).toHaveBeenCalledWith('podcast-1');
    });

    test('should throw NotFoundException when podcast not found', async () => {
      const { prisma, podcastRepository } = makeMocks();

      podcastRepository.findById.mockResolvedValue(null);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      await expect(service.remove('podcast-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    test('should throw ForbiddenException when user is not author', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
        title: 'Test Podcast',
        authorId: 'user-1',
      };

      podcastRepository.findById.mockResolvedValue(mockPodcast);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      await expect(service.remove('podcast-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('createRating', () => {
    test('should create rating for podcast', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
        title: 'Test Podcast',
      };

      const createRatingDto = {
        overallRating: 5,
        difficultyRating: 3,
        qualityRating: 4,
        review: 'Great podcast!',
        title: 'Excellent',
      };

      const mockRating = {
        id: 'rating-1',
        userId: 'user-1',
        podcastId: 'podcast-1',
        ...createRatingDto,
        user: {
          id: 'user-1',
          displayName: 'Test User',
          firstName: 'Test',
          lastName: 'User',
        },
      };

      podcastRepository.findById.mockResolvedValue(mockPodcast);
      podcastRepository.upsertRating.mockResolvedValue(mockRating);
      podcastRepository.aggregatePodcastRating.mockResolvedValue({
        _avg: {
          overallRating: 5,
          difficultyRating: 3,
          qualityRating: 4,
        },
        _count: { _all: 1 },
      });
      podcastRepository.updatePodcast.mockResolvedValue({});

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      const result = await service.createRating(
        'podcast-1',
        'user-1',
        createRatingDto,
      );

      expect(result).toEqual(mockRating);
      expect(podcastRepository.upsertRating).toHaveBeenCalled();
      expect(podcastRepository.updatePodcast).toHaveBeenCalled();
    });

    test('should throw NotFoundException when podcast not found', async () => {
      const { prisma, podcastRepository } = makeMocks();

      podcastRepository.findById.mockResolvedValue(null);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      await expect(
        service.createRating('podcast-1', 'user-1', {
          overallRating: 5,
          review: 'Test',
          title: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRatings', () => {
    test('should return paginated ratings', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockRatings = [
        {
          id: 'rating-1',
          overallRating: 5,
          user: {
            id: 'user-1',
            displayName: 'User 1',
          },
        },
        {
          id: 'rating-2',
          overallRating: 4,
          user: {
            id: 'user-2',
            displayName: 'User 2',
          },
        },
      ];

      podcastRepository.listRatings.mockResolvedValue(mockRatings);
      podcastRepository.countRatings.mockResolvedValue(2);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      const result = await service.getRatings('podcast-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toEqual(mockRatings);
      expect(result.totalItems).toBe(2);
    });
  });

  describe('startPodcastAttempt', () => {
    test('should create new attempt when no in-progress attempt exists', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
        title: 'Test Podcast',
        transcript: 'This is a test transcript',
        duration: 300,
        difficulty: PodcastDifficulty.beginner,
        authorId: 'author-1',
        gaps: [
          {
            id: 'gap-1',
            startIndex: 0,
            endIndex: 4,
            answer: 'This',
            orderNo: 1,
          },
        ],
      };

      const mockAttempt = {
        id: 'attempt-1',
        attemptNo: 1,
        status: 'in_progress',
        answers: [],
        timeSpent: 0,
      };

      prisma.podcast.findUnique.mockResolvedValue(mockPodcast);
      prisma.podcastAttempt.findFirst
        .mockResolvedValueOnce(null) // No in-progress attempt
        .mockResolvedValueOnce(null); // No last attempt
      prisma.podcastAttempt.create.mockResolvedValue(mockAttempt);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      const result = await service.startPodcastAttempt('podcast-1', 'user-1');

      expect(result.podcastId).toBe('podcast-1');
      expect(result.attemptId).toBe('attempt-1');
      expect(result.attemptNo).toBe(1);
      expect(result.transcriptMasked).toContain('____');
      expect(prisma.podcastAttempt.create).toHaveBeenCalled();
    });

    test('should return existing in-progress attempt', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
        title: 'Test Podcast',
        transcript: 'This is a test transcript',
        duration: 300,
        difficulty: PodcastDifficulty.beginner,
        authorId: 'author-1',
        gaps: [
          {
            id: 'gap-1',
            startIndex: 0,
            endIndex: 4,
            answer: 'This',
            orderNo: 1,
          },
        ],
      };

      const mockExistingAttempt = {
        id: 'attempt-1',
        attemptNo: 1,
        status: 'in_progress',
        answers: { 'gap-1': 'Test' },
        timeSpent: 100,
      };

      prisma.podcast.findUnique.mockResolvedValue(mockPodcast);
      prisma.podcastAttempt.findFirst.mockResolvedValue(mockExistingAttempt);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      const result = await service.startPodcastAttempt('podcast-1', 'user-1');

      expect(result.attemptId).toBe('attempt-1');
      expect(result.answers).toEqual({ 'gap-1': 'Test' });
      expect(result.timeSpent).toBe(100);
      expect(prisma.podcastAttempt.create).not.toHaveBeenCalled();
    });

    test('should throw NotFoundException when podcast not found', async () => {
      const { prisma, podcastRepository } = makeMocks();

      prisma.podcast.findUnique.mockResolvedValue(null);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      await expect(
        service.startPodcastAttempt('podcast-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitPodcastAttempt', () => {
    test('should score attempt correctly', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
        gaps: [
          { id: 'gap-1', answer: 'This' },
          { id: 'gap-2', answer: 'test' },
        ],
      };

      const mockAttempt = {
        id: 'attempt-1',
        status: 'in_progress',
      };

      const answers = {
        'gap-1': 'This',
        'gap-2': 'wrong',
      };

      const mockUpdatedAttempt = {
        id: 'attempt-1',
        status: 'submitted',
        correctCount: 1,
        totalQuestions: 2,
        scorePercent: 50,
      };

      prisma.podcast.findUnique.mockResolvedValue(mockPodcast);
      prisma.podcastAttempt.findUnique.mockResolvedValue(mockAttempt);
      prisma.podcastAttempt.update.mockResolvedValue(mockUpdatedAttempt);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      const result = await service.submitPodcastAttempt(
        'podcast-1',
        'attempt-1',
        answers,
      );

      expect(result.correctCount).toBe(1);
      expect(result.totalQuestions).toBe(2);
      expect(result.scorePercent).toBe(50);
      expect(result.status).toBe('submitted');
    });

    test('should throw NotFoundException when podcast not found', async () => {
      const { prisma, podcastRepository } = makeMocks();

      prisma.podcast.findUnique.mockResolvedValue(null);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      await expect(
        service.submitPodcastAttempt('podcast-1', 'attempt-1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    test('should throw NotFoundException when attempt not found', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
        gaps: [],
      };

      prisma.podcast.findUnique.mockResolvedValue(mockPodcast);
      prisma.podcastAttempt.findUnique.mockResolvedValue(null);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      await expect(
        service.submitPodcastAttempt('podcast-1', 'attempt-1', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('saveDraft', () => {
    test('should save draft answers', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
      };

      const mockAttempt = {
        id: 'attempt-1',
        status: 'in_progress',
      };

      const answers = {
        'gap-1': 'This',
      };

      const mockUpdatedAttempt = {
        id: 'attempt-1',
        status: 'in_progress',
        answers,
        timeSpent: 50,
      };

      prisma.podcast.findUnique.mockResolvedValue(mockPodcast);
      prisma.podcastAttempt.findUnique.mockResolvedValue(mockAttempt);
      prisma.podcastAttempt.update.mockResolvedValue(mockUpdatedAttempt);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      const result = await service.saveDraft(
        'podcast-1',
        'attempt-1',
        answers,
        50,
      );

      expect(result.attemptId).toBe('attempt-1');
      expect(result.savedAnswers).toEqual(answers);
      expect(result.status).toBe('in_progress');
    });

    test('should throw BadRequestException when attempt is not in progress', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
      };

      const mockAttempt = {
        id: 'attempt-1',
        status: 'submitted',
      };

      prisma.podcast.findUnique.mockResolvedValue(mockPodcast);
      prisma.podcastAttempt.findUnique.mockResolvedValue(mockAttempt);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      await expect(
        service.saveDraft('podcast-1', 'attempt-1', {}, 50),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPodcastAttempts', () => {
    test('should return user attempts for podcast', async () => {
      const { prisma, podcastRepository } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
      };

      const mockAttempts = [
        {
          id: 'attempt-1',
          attemptNo: 1,
          status: 'submitted',
          scorePercent: 100,
          correctCount: 2,
          totalQuestions: 2,
          timeSpent: 120,
          createdAt: new Date(),
          answers: {},
        },
        {
          id: 'attempt-2',
          attemptNo: 2,
          status: 'submitted',
          scorePercent: 50,
          correctCount: 1,
          totalQuestions: 2,
          timeSpent: 100,
          createdAt: new Date(),
          answers: {},
        },
      ];

      prisma.podcast.findUnique.mockResolvedValue(mockPodcast);
      prisma.podcastAttempt.findMany.mockResolvedValue(mockAttempts);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      const result = await service.getPodcastAttempts('podcast-1', 'user-1');

      expect(result).toHaveLength(2);
      expect(result[0].attemptNo).toBe(1);
      expect(result[1].attemptNo).toBe(2);
    });

    test('should throw NotFoundException when podcast not found', async () => {
      const { prisma, podcastRepository } = makeMocks();

      prisma.podcast.findUnique.mockResolvedValue(null);

      const service = new PodcastService(
        prisma as any,
        podcastRepository as any,
      );

      await expect(
        service.getPodcastAttempts('podcast-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
