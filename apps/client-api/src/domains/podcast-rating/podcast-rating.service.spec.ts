import { Test, TestingModule } from '@nestjs/testing';
import { PrismaRepository } from '@app/database';
import { PodcastRatingService } from './podcast-rating.service';
import { CreatePodcastRatingDto } from './podcast-rating.dto';

const mockPrismaRepository = {
  podcastRating: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

describe('PodcastRatingService', () => {
  let service: PodcastRatingService;
  let prisma: typeof mockPrismaRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PodcastRatingService,
        {
          provide: PrismaRepository,
          useValue: mockPrismaRepository,
        },
      ],
    }).compile();

    service = module.get<PodcastRatingService>(PodcastRatingService);
    prisma = module.get(PrismaRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrUpdate', () => {
    const userId = 'user-1';
    const createDto: CreatePodcastRatingDto = {
      podcastId: 'podcast-1',
      overallRating: 5,
      difficultyRating: 4,
      qualityRating: 5,
    };

    it('should create a new rating if one does not exist', async () => {
      prisma.podcastRating.findFirst.mockResolvedValue(null);
      prisma.podcastRating.create.mockResolvedValue({ id: 'rating-1', ...createDto, userId });

      const result = await service.createOrUpdate(userId, createDto);

      expect(prisma.podcastRating.findFirst).toHaveBeenCalledWith({
        where: { userId, podcastId: createDto.podcastId },
      });
      expect(prisma.podcastRating.create).toHaveBeenCalledWith({
        data: { userId, ...createDto },
      });
      expect(result).toEqual({ id: 'rating-1', ...createDto, userId });
    });

    it('should update an existing rating', async () => {
      const existingRating = { id: 'rating-1', userId, podcastId: 'podcast-1', overallRating: 3, difficultyRating: 3, qualityRating: 3 };
      prisma.podcastRating.findFirst.mockResolvedValue(existingRating);
      prisma.podcastRating.update.mockResolvedValue({ ...existingRating, ...createDto });

      const result = await service.createOrUpdate(userId, createDto);

      expect(prisma.podcastRating.findFirst).toHaveBeenCalledWith({
        where: { userId, podcastId: createDto.podcastId },
      });
      expect(prisma.podcastRating.update).toHaveBeenCalledWith({
        where: { id: existingRating.id },
        data: {
          overallRating: createDto.overallRating,
          difficultyRating: createDto.difficultyRating,
          qualityRating: createDto.qualityRating,
        },
      });
      expect(result).toEqual({ ...existingRating, ...createDto });
    });
  });

  describe('getByUserAndPodcast', () => {
    it('should return a rating for a user and podcast', async () => {
      const rating = { id: 'rating-1', userId: 'user-1', podcastId: 'podcast-1', overallRating: 5 };
      prisma.podcastRating.findFirst.mockResolvedValue(rating);

      const result = await service.getByUserAndPodcast('user-1', 'podcast-1');

      expect(prisma.podcastRating.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', podcastId: 'podcast-1' },
      });
      expect(result).toEqual(rating);
    });
  });

  describe('getAggregatedForPodcast', () => {
    it('should return aggregated ratings for a podcast', async () => {
        const ratings = [
            { overallRating: 5, difficultyRating: 4, qualityRating: 5 },
            { overallRating: 4, difficultyRating: 3, qualityRating: 4 },
            { overallRating: null, difficultyRating: 5, qualityRating: 5 },
        ];
        prisma.podcastRating.findMany.mockResolvedValue(ratings);

        const result = await service.getAggregatedForPodcast('podcast-1');

        expect(prisma.podcastRating.findMany).toHaveBeenCalledWith({
            where: { podcastId: 'podcast-1' },
            select: {
                overallRating: true,
                difficultyRating: true,
                qualityRating: true,
            },
        });

        expect(result).toEqual({
            averageOverall: 3.00,
            averageDifficulty: 4.00,
            averageQuality: 4.67,
            total: 3,
        });
    });

    it('should return null averages when no ratings exist', async () => {
      prisma.podcastRating.findMany.mockResolvedValue([]);
      const result = await service.getAggregatedForPodcast('podcast-1');
      expect(result).toEqual({
        averageOverall: null,
        averageDifficulty: null,
        averageQuality: null,
        total: 0,
      });
    });
  });

  describe('deleteRating', () => {
    it('should delete a rating if it exists', async () => {
      const existingRating = { id: 'rating-1', userId: 'user-1', podcastId: 'podcast-1' };
      prisma.podcastRating.findFirst.mockResolvedValue(existingRating);
      prisma.podcastRating.delete.mockResolvedValue(existingRating);

      const result = await service.deleteRating('user-1', 'podcast-1');

      expect(prisma.podcastRating.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', podcastId: 'podcast-1' },
      });
      expect(prisma.podcastRating.delete).toHaveBeenCalledWith({
        where: { id: existingRating.id },
      });
      expect(result).toEqual(existingRating);
    });

    it('should return null if the rating does not exist', async () => {
      prisma.podcastRating.findFirst.mockResolvedValue(null);
      const result = await service.deleteRating('user-1', 'podcast-1');
      expect(prisma.podcastRating.delete).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('listRatings', () => {
    it('should return a paginated list of ratings', async () => {
      const ratings = [{ id: 'rating-1' }];
      const total = 1;
      prisma.podcastRating.findMany.mockResolvedValue(ratings);
      prisma.podcastRating.count.mockResolvedValue(total);

      const result = await service.listRatings('podcast-1', 1, 10);

      expect(prisma.podcastRating.findMany).toHaveBeenCalledWith({
        where: { podcastId: 'podcast-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
      expect(prisma.podcastRating.count).toHaveBeenCalledWith({ where: { podcastId: 'podcast-1' } });
      expect(result).toEqual({ data: ratings, total });
    });
  });

  describe('hasUserRated', () => {
    it('should return the rating if the user has rated the podcast', async () => {
      const rating = { id: 'rating-1' };
      prisma.podcastRating.findFirst.mockResolvedValue(rating);
      const result = await service.hasUserRated('user-1', 'podcast-1');
      expect(result).toEqual(rating);
    });

    it('should return null if the user has not rated the podcast', async () => {
      prisma.podcastRating.findFirst.mockResolvedValue(null);
      const result = await service.hasUserRated('user-1', 'podcast-1');
      expect(result).toBeNull();
    });
  });
});