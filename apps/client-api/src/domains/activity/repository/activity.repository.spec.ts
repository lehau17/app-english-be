import { ActivityRepository } from './activity.repository';
import { PrismaRepository } from '@app/database';
import {
  Activity,
  ActivityType,
  DifficultyLevel,
  Prisma,
} from '@prisma/client';
import {
  CreateActivityDto,
  FilterActivityRequestDto,
} from '../dto/activity.dto';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';

describe('ActivityRepository', () => {
  let repository: ActivityRepository;
  let prisma: jest.Mocked<PrismaRepository>;

  const mockActivity: Activity = {
    id: 'activity-1',
    lessonId: 'lesson-1',
    type: ActivityType.quiz,
    orderNo: 1,
    content: {
      question: 'Test question?',
      options: ['A', 'B', 'C'],
      correctIndex: 0,
    },
    difficultyLevel: DifficultyLevel.beginner,
    points: 10,
    timeLimit: 60,
    passingScore: 70,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Create mock Prisma repository
    prisma = {
      activity: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as any;

    // Create repository with mocked Prisma
    repository = new ActivityRepository(prisma);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('create', () => {
    it('should create a new activity', async () => {
      const createDto: CreateActivityDto = {
        lessonId: 'lesson-1',
        type: ActivityType.quiz,
        orderNo: 1,
        content: {
          question: 'Test question?',
          options: ['A', 'B', 'C'],
          correctIndex: 0,
        },
        difficultyLevel: DifficultyLevel.beginner,
        points: 10,
        timeLimit: 60,
        passingScore: 70,
      };

      prisma.activity.create.mockResolvedValue(mockActivity);

      const result = await repository.create(createDto);

      expect(result).toEqual(mockActivity);
      expect(prisma.activity.create).toHaveBeenCalledTimes(1);
      expect(prisma.activity.create).toHaveBeenCalledWith({ data: createDto });
    });
  });

  describe('findById', () => {
    it('should return an activity when found', async () => {
      prisma.activity.findUnique.mockResolvedValue(mockActivity);

      const result = await repository.findById('activity-1');

      expect(result).toEqual(mockActivity);
      expect(prisma.activity.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.activity.findUnique).toHaveBeenCalledWith({
        where: { id: 'activity-1' },
      });
    });

    it('should return null when activity not found', async () => {
      prisma.activity.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
      expect(prisma.activity.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
    });
  });

  describe('update', () => {
    it('should update an activity', async () => {
      const updateData: Prisma.ActivityUpdateInput = {
        points: 20,
        timeLimit: 90,
      };

      const updatedActivity = { ...mockActivity, points: 20, timeLimit: 90 };
      prisma.activity.update.mockResolvedValue(updatedActivity);

      const result = await repository.update('activity-1', updateData);

      expect(result).toEqual(updatedActivity);
      expect(prisma.activity.update).toHaveBeenCalledTimes(1);
      expect(prisma.activity.update).toHaveBeenCalledWith({
        where: { id: 'activity-1' },
        data: updateData,
      });
    });
  });

  describe('delete', () => {
    it('should delete an activity', async () => {
      prisma.activity.delete.mockResolvedValue(mockActivity);

      const result = await repository.delete('activity-1');

      expect(result).toEqual(mockActivity);
      expect(prisma.activity.delete).toHaveBeenCalledTimes(1);
      expect(prisma.activity.delete).toHaveBeenCalledWith({
        where: { id: 'activity-1' },
      });
    });
  });

  describe('list', () => {
    it('should return paginated list with default parameters', async () => {
      const params: FilterActivityRequestDto = {
        page: 1,
        limit: 10,
      };

      prisma.activity.count.mockResolvedValue(1);
      prisma.activity.findMany.mockResolvedValue([mockActivity]);

      const result = await repository.list(params);

      expect(result).toBeInstanceOf(PageResponseDto);
      expect(result.data).toEqual([mockActivity]);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalItems).toBe(1);
      expect(result.totalPages).toBe(1);

      expect(prisma.activity.count).toHaveBeenCalledWith({
        where: {
          lessonId: undefined,
          type: undefined,
          OR: undefined,
        },
      });

      expect(prisma.activity.findMany).toHaveBeenCalledWith({
        where: {
          lessonId: undefined,
          type: undefined,
          OR: undefined,
        },
        skip: 0,
        take: 10,
        orderBy: { orderNo: 'asc' },
      });
    });

    it('should filter by lessonId', async () => {
      const params: FilterActivityRequestDto = {
        page: 1,
        limit: 10,
        lessonId: 'lesson-1',
      };

      prisma.activity.count.mockResolvedValue(1);
      prisma.activity.findMany.mockResolvedValue([mockActivity]);

      const result = await repository.list(params);

      expect(result.data).toEqual([mockActivity]);
      expect(prisma.activity.count).toHaveBeenCalledWith({
        where: {
          lessonId: 'lesson-1',
          type: undefined,
          OR: undefined,
        },
      });
    });

    it('should filter by type', async () => {
      const params: FilterActivityRequestDto = {
        page: 1,
        limit: 10,
        type: ActivityType.quiz,
      };

      prisma.activity.count.mockResolvedValue(1);
      prisma.activity.findMany.mockResolvedValue([mockActivity]);

      const result = await repository.list(params);

      expect(result.data).toEqual([mockActivity]);
      expect(prisma.activity.count).toHaveBeenCalledWith({
        where: {
          lessonId: undefined,
          type: ActivityType.quiz,
          OR: undefined,
        },
      });
    });

    it('should filter by search term', async () => {
      const params: FilterActivityRequestDto = {
        page: 1,
        limit: 10,
        search: 'test',
      };

      prisma.activity.count.mockResolvedValue(1);
      prisma.activity.findMany.mockResolvedValue([mockActivity]);

      const result = await repository.list(params);

      expect(result.data).toEqual([mockActivity]);
      expect(prisma.activity.count).toHaveBeenCalledWith({
        where: {
          lessonId: undefined,
          type: undefined,
          OR: [{ content: { array_contains: 'test', mode: 'insensitive' } }],
        },
      });
    });

    it('should handle custom sorting', async () => {
      const params: FilterActivityRequestDto = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      prisma.activity.count.mockResolvedValue(1);
      prisma.activity.findMany.mockResolvedValue([mockActivity]);

      await repository.list(params);

      expect(prisma.activity.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle pagination correctly', async () => {
      const params: FilterActivityRequestDto = {
        page: 2,
        limit: 5,
      };

      prisma.activity.count.mockResolvedValue(15);
      prisma.activity.findMany.mockResolvedValue([mockActivity]);

      const result = await repository.list(params);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.totalItems).toBe(15);
      expect(result.totalPages).toBe(3);

      expect(prisma.activity.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        skip: 5, // (page 2 - 1) * limit 5
        take: 5,
        orderBy: expect.any(Object),
      });
    });

    it('should adjust page to totalPages if page exceeds', async () => {
      const params: FilterActivityRequestDto = {
        page: 10, // Request page 10
        limit: 10,
      };

      prisma.activity.count.mockResolvedValue(15); // Only 2 pages available
      prisma.activity.findMany.mockResolvedValue([mockActivity]);

      const result = await repository.list(params);

      expect(result.page).toBe(2); // Should be adjusted to last page
      expect(result.totalPages).toBe(2);

      expect(prisma.activity.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        skip: 10, // (page 2 - 1) * limit 10
        take: 10,
        orderBy: expect.any(Object),
      });
    });

    it('should handle empty results', async () => {
      const params: FilterActivityRequestDto = {
        page: 1,
        limit: 10,
        search: 'non-existent',
      };

      prisma.activity.count.mockResolvedValue(0);
      prisma.activity.findMany.mockResolvedValue([]);

      const result = await repository.list(params);

      expect(result.data).toEqual([]);
      expect(result.totalItems).toBe(0);
      expect(result.totalPages).toBe(0); // No pages when no items
    });

    it('should combine multiple filters', async () => {
      const params: FilterActivityRequestDto = {
        page: 1,
        limit: 10,
        lessonId: 'lesson-1',
        type: ActivityType.quiz,
        search: 'test',
        sortBy: 'points',
        sortOrder: 'desc',
      };

      prisma.activity.count.mockResolvedValue(1);
      prisma.activity.findMany.mockResolvedValue([mockActivity]);

      await repository.list(params);

      expect(prisma.activity.count).toHaveBeenCalledWith({
        where: {
          lessonId: 'lesson-1',
          type: ActivityType.quiz,
          OR: [{ content: { array_contains: 'test', mode: 'insensitive' } }],
        },
      });

      expect(prisma.activity.findMany).toHaveBeenCalledWith({
        where: {
          lessonId: 'lesson-1',
          type: ActivityType.quiz,
          OR: [{ content: { array_contains: 'test', mode: 'insensitive' } }],
        },
        skip: 0,
        take: 10,
        orderBy: { points: 'desc' },
      });
    });
  });
});
