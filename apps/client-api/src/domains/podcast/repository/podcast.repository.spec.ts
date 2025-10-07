import { PodcastRepository } from './podcast.repository';
import { PrismaRepository } from '@app/database';
import { PodcastCategory, PodcastDifficulty, PodcastSource } from '@prisma/client';

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
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  return { prisma };
};

describe('PodcastRepository', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('findAll', () => {
    test('should return podcasts with filters', async () => {
      const { prisma } = makeMocks();

      const mockPodcasts = [
        {
          id: 'podcast-1',
          title: 'Daily Conversation',
          category: PodcastCategory.daily_conversation,
          difficulty: PodcastDifficulty.beginner,
          author: {
            id: 'author-1',
            displayName: 'Test Author',
            firstName: 'Test',
            lastName: 'Author',
          },
        },
      ];

      prisma.podcast.findMany.mockResolvedValue(mockPodcasts);
      prisma.podcast.count.mockResolvedValue(1);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.findAll('user-1', {
        page: 1,
        limit: 20,
        category: PodcastCategory.daily_conversation,
      });

      expect(result.items).toEqual(mockPodcasts);
      expect(result.total).toBe(1);
      expect(prisma.podcast.findMany).toHaveBeenCalled();
      expect(prisma.podcast.count).toHaveBeenCalled();
    });

    test('should filter by search term', async () => {
      const { prisma } = makeMocks();

      prisma.podcast.findMany.mockResolvedValue([]);
      prisma.podcast.count.mockResolvedValue(0);

      const repository = new PodcastRepository(prisma as any);

      await repository.findAll('user-1', {
        page: 1,
        limit: 20,
        search: 'test',
      });

      const findManyCall = prisma.podcast.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.OR.length).toBeGreaterThan(0);
    });

    test('should filter by difficulty', async () => {
      const { prisma } = makeMocks();

      prisma.podcast.findMany.mockResolvedValue([]);
      prisma.podcast.count.mockResolvedValue(0);

      const repository = new PodcastRepository(prisma as any);

      await repository.findAll('user-1', {
        page: 1,
        limit: 20,
        difficulty: PodcastDifficulty.intermediate,
      });

      const findManyCall = prisma.podcast.findMany.mock.calls[0][0];
      expect(findManyCall.where.difficulty).toBe(PodcastDifficulty.intermediate);
    });

    test('should filter by duration range (short)', async () => {
      const { prisma } = makeMocks();

      prisma.podcast.findMany.mockResolvedValue([]);
      prisma.podcast.count.mockResolvedValue(0);

      const repository = new PodcastRepository(prisma as any);

      await repository.findAll('user-1', {
        page: 1,
        limit: 20,
        duration: 'short',
      });

      const findManyCall = prisma.podcast.findMany.mock.calls[0][0];
      expect(findManyCall.where.duration).toEqual({ lt: 600 });
    });

    test('should filter by duration range (medium)', async () => {
      const { prisma } = makeMocks();

      prisma.podcast.findMany.mockResolvedValue([]);
      prisma.podcast.count.mockResolvedValue(0);

      const repository = new PodcastRepository(prisma as any);

      await repository.findAll('user-1', {
        page: 1,
        limit: 20,
        duration: 'medium',
      });

      const findManyCall = prisma.podcast.findMany.mock.calls[0][0];
      expect(findManyCall.where.duration).toEqual({ gte: 600, lte: 1200 });
    });

    test('should filter by duration range (long)', async () => {
      const { prisma } = makeMocks();

      prisma.podcast.findMany.mockResolvedValue([]);
      prisma.podcast.count.mockResolvedValue(0);

      const repository = new PodcastRepository(prisma as any);

      await repository.findAll('user-1', {
        page: 1,
        limit: 20,
        duration: 'long',
      });

      const findManyCall = prisma.podcast.findMany.mock.calls[0][0];
      expect(findManyCall.where.duration).toEqual({ gt: 1200 });
    });

    test('should sort by newest', async () => {
      const { prisma } = makeMocks();

      prisma.podcast.findMany.mockResolvedValue([]);
      prisma.podcast.count.mockResolvedValue(0);

      const repository = new PodcastRepository(prisma as any);

      await repository.findAll('user-1', {
        page: 1,
        limit: 20,
        sortBy: 'newest',
        sortOrder: 'desc',
      });

      const findManyCall = prisma.podcast.findMany.mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ createdAt: 'desc' });
    });

    test('should sort by popular', async () => {
      const { prisma } = makeMocks();

      prisma.podcast.findMany.mockResolvedValue([]);
      prisma.podcast.count.mockResolvedValue(0);

      const repository = new PodcastRepository(prisma as any);

      await repository.findAll('user-1', {
        page: 1,
        limit: 20,
        sortBy: 'popular',
      });

      const findManyCall = prisma.podcast.findMany.mock.calls[0][0];
      expect(findManyCall.orderBy.viewCount).toBeDefined();
    });

    test('should paginate results', async () => {
      const { prisma } = makeMocks();

      prisma.podcast.findMany.mockResolvedValue([]);
      prisma.podcast.count.mockResolvedValue(0);

      const repository = new PodcastRepository(prisma as any);

      await repository.findAll('user-1', {
        page: 2,
        limit: 10,
      });

      const findManyCall = prisma.podcast.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(10);
      expect(findManyCall.take).toBe(10);
    });
  });

  describe('findById', () => {
    test('should return podcast with gaps', async () => {
      const { prisma } = makeMocks();

      const mockPodcast = {
        id: 'podcast-1',
        title: 'Test Podcast',
        gaps: [
          {
            id: 'gap-1',
            startIndex: 0,
            endIndex: 4,
            answer: 'test',
          },
        ],
      };

      prisma.podcast.findUnique.mockResolvedValue(mockPodcast);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.findById('podcast-1');

      expect(result).toEqual(mockPodcast);
      expect(prisma.podcast.findUnique).toHaveBeenCalledWith({
        where: { id: 'podcast-1' },
        include: { gaps: true },
      });
    });
  });

  describe('createPodcast', () => {
    test('should create podcast with gaps and author', async () => {
      const { prisma } = makeMocks();

      const createData = {
        code: 'test-podcast-123',
        title: 'Test Podcast',
        description: 'Test Description',
        audioUrl: 'http://example.com/audio.mp3',
        transcript: 'Test transcript',
        category: PodcastCategory.daily_conversation,
        difficulty: PodcastDifficulty.beginner,
        duration: 300,
        author: {
          connect: { id: 'author-1' },
        },
        gaps: {
          create: [
            {
              startIndex: 0,
              endIndex: 4,
              answer: 'Test',
              orderNo: 1,
            },
          ],
        },
      };

      const mockCreatedPodcast = {
        id: 'podcast-1',
        ...createData,
        gaps: [
          {
            id: 'gap-1',
            startIndex: 0,
            endIndex: 4,
            answer: 'Test',
            orderNo: 1,
          },
        ],
        author: {
          id: 'author-1',
          firstName: 'Test',
          lastName: 'Author',
        },
      };

      prisma.podcast.create.mockResolvedValue(mockCreatedPodcast);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.createPodcast(createData);

      expect(result).toEqual(mockCreatedPodcast);
      expect(prisma.podcast.create).toHaveBeenCalledWith({
        data: createData,
        include: {
          gaps: true,
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });
  });

  describe('updatePodcast', () => {
    test('should update podcast', async () => {
      const { prisma } = makeMocks();

      const updateData = {
        title: 'Updated Title',
        description: 'Updated Description',
      };

      const mockUpdatedPodcast = {
        id: 'podcast-1',
        ...updateData,
      };

      prisma.podcast.update.mockResolvedValue(mockUpdatedPodcast);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.updatePodcast('podcast-1', updateData);

      expect(result).toEqual(mockUpdatedPodcast);
      expect(prisma.podcast.update).toHaveBeenCalledWith({
        where: { id: 'podcast-1' },
        data: updateData,
      });
    });
  });

  describe('deletePodcast', () => {
    test('should delete podcast', async () => {
      const { prisma } = makeMocks();

      const mockDeletedPodcast = {
        id: 'podcast-1',
        title: 'Deleted Podcast',
      };

      prisma.podcast.delete.mockResolvedValue(mockDeletedPodcast);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.deletePodcast('podcast-1');

      expect(result).toEqual(mockDeletedPodcast);
      expect(prisma.podcast.delete).toHaveBeenCalledWith({
        where: { id: 'podcast-1' },
      });
    });
  });

  describe('upsertRating', () => {
    test('should upsert rating', async () => {
      const { prisma } = makeMocks();

      const upsertArgs = {
        where: {
          userId_podcastId: {
            userId: 'user-1',
            podcastId: 'podcast-1',
          },
        },
        update: {
          overallRating: 5,
          comment: 'Great!',
        },
        create: {
          overallRating: 5,
          comment: 'Great!',
          user: { connect: { id: 'user-1' } },
          podcast: { connect: { id: 'podcast-1' } },
        },
      };

      const mockRating = {
        id: 'rating-1',
        userId: 'user-1',
        podcastId: 'podcast-1',
        overallRating: 5,
      };

      prisma.podcastRating.upsert.mockResolvedValue(mockRating);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.upsertRating(upsertArgs);

      expect(result).toEqual(mockRating);
      expect(prisma.podcastRating.upsert).toHaveBeenCalledWith(upsertArgs);
    });
  });

  describe('listRatings', () => {
    test('should list ratings with pagination', async () => {
      const { prisma } = makeMocks();

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

      prisma.podcastRating.findMany.mockResolvedValue(mockRatings);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.listRatings({
        where: { podcastId: 'podcast-1' },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual(mockRatings);
    });
  });

  describe('countRatings', () => {
    test('should count ratings for podcast', async () => {
      const { prisma } = makeMocks();

      prisma.podcastRating.count.mockResolvedValue(5);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.countRatings('podcast-1');

      expect(result).toBe(5);
      expect(prisma.podcastRating.count).toHaveBeenCalledWith({
        where: { podcastId: 'podcast-1' },
      });
    });
  });

  describe('aggregatePodcastRating', () => {
    test('should aggregate ratings', async () => {
      const { prisma } = makeMocks();

      const mockAggregate = {
        _avg: {
          overallRating: 4.5,
          difficultyRating: 3.2,
          qualityRating: 4.0,
        },
        _count: {
          _all: 10,
        },
      };

      prisma.podcastRating.aggregate.mockResolvedValue(mockAggregate);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.aggregatePodcastRating('podcast-1');

      expect(result).toEqual(mockAggregate);
      expect(prisma.podcastRating.aggregate).toHaveBeenCalledWith({
        where: { podcastId: 'podcast-1' },
        _avg: {
          overallRating: true,
          difficultyRating: true,
          qualityRating: true,
        },
        _count: { _all: true },
      });
    });
  });

  describe('createAttempt', () => {
    test('should create podcast attempt', async () => {
      const { prisma } = makeMocks();

      const attemptData = {
        podcast: { connect: { id: 'podcast-1' } },
        user: { connect: { id: 'user-1' } },
        attemptNo: 1,
        status: 'in_progress',
        answers: [],
      };

      const mockAttempt = {
        id: 'attempt-1',
        podcastId: 'podcast-1',
        userId: 'user-1',
        attemptNo: 1,
        status: 'in_progress',
        answers: [],
      };

      prisma.podcastAttempt.create.mockResolvedValue(mockAttempt);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.createAttempt(attemptData as any);

      expect(result).toEqual(mockAttempt);
      expect(prisma.podcastAttempt.create).toHaveBeenCalledWith({
        data: attemptData,
      });
    });
  });

  describe('findAttemptById', () => {
    test('should find attempt by id', async () => {
      const { prisma } = makeMocks();

      const mockAttempt = {
        id: 'attempt-1',
        attemptNo: 1,
        status: 'submitted',
        scorePercent: 100,
      };

      prisma.podcastAttempt.findUnique.mockResolvedValue(mockAttempt);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.findAttemptById('attempt-1');

      expect(result).toEqual(mockAttempt);
      expect(prisma.podcastAttempt.findUnique).toHaveBeenCalledWith({
        where: { id: 'attempt-1' },
      });
    });
  });

  describe('updateAttempt', () => {
    test('should update attempt', async () => {
      const { prisma } = makeMocks();

      const updateData = {
        status: 'submitted',
        scorePercent: 90,
        correctCount: 9,
        totalQuestions: 10,
      };

      const mockUpdatedAttempt = {
        id: 'attempt-1',
        ...updateData,
      };

      prisma.podcastAttempt.update.mockResolvedValue(mockUpdatedAttempt);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.updateAttempt('attempt-1', updateData);

      expect(result).toEqual(mockUpdatedAttempt);
      expect(prisma.podcastAttempt.update).toHaveBeenCalledWith({
        where: { id: 'attempt-1' },
        data: updateData,
      });
    });
  });

  describe('listAttempts', () => {
    test('should list attempts for user and podcast', async () => {
      const { prisma } = makeMocks();

      const mockAttempts = [
        {
          id: 'attempt-1',
          attemptNo: 1,
          status: 'submitted',
          scorePercent: 100,
          createdAt: new Date(),
        },
        {
          id: 'attempt-2',
          attemptNo: 2,
          status: 'submitted',
          scorePercent: 50,
          createdAt: new Date(),
        },
      ];

      prisma.podcastAttempt.findMany.mockResolvedValue(mockAttempts);

      const repository = new PodcastRepository(prisma as any);

      const result = await repository.listAttempts('podcast-1', 'user-1');

      expect(result).toEqual(mockAttempts);
      expect(prisma.podcastAttempt.findMany).toHaveBeenCalledWith({
        where: { podcastId: 'podcast-1', userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
