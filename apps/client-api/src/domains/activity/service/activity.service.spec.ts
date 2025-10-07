import { NotFoundException } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityRepository } from '../repository/activity.repository';
import { Activity, ActivityType, DifficultyLevel } from '@prisma/client';
import {
  CreateActivityDto,
  UpdateActivityDto,
  FilterActivityRequestDto,
} from '../dto/activity.dto';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';

describe('ActivityService', () => {
  let service: ActivityService;
  let repository: jest.Mocked<ActivityRepository>;

  const mockActivity: Activity = {
    id: 'activity-1',
    lessonId: 'lesson-1',
    type: ActivityType.quiz,
    orderNo: 1,
    content: { question: 'Test question?', options: ['A', 'B', 'C'], correctIndex: 0 },
    difficultyLevel: DifficultyLevel.beginner,
    points: 10,
    timeLimit: 60,
    passingScore: 70,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Create mock repository
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
    } as any;

    // Create service with mocked repository
    service = new ActivityService(repository);
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
        content: { question: 'Test question?', options: ['A', 'B', 'C'], correctIndex: 0 },
        difficultyLevel: DifficultyLevel.beginner,
        points: 10,
        timeLimit: 60,
        passingScore: 70,
      };

      repository.create.mockResolvedValue(mockActivity);

      const result = await service.create(createDto);

      expect(result).toEqual(mockActivity);
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findById', () => {
    it('should return an activity when found', async () => {
      repository.findById.mockResolvedValue(mockActivity);

      const result = await service.findById('activity-1');

      expect(result).toEqual(mockActivity);
      expect(repository.findById).toHaveBeenCalledTimes(1);
      expect(repository.findById).toHaveBeenCalledWith('activity-1');
    });

    it('should throw NotFoundException when activity not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent-id')).rejects.toThrow(
        'Activity with id non-existent-id not found',
      );
      expect(repository.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('update', () => {
    it('should update an existing activity', async () => {
      const updateDto: UpdateActivityDto = {
        points: 20,
        timeLimit: 90,
      };

      const updatedActivity = { ...mockActivity, ...updateDto };

      repository.findById.mockResolvedValue(mockActivity);
      repository.update.mockResolvedValue(updatedActivity);

      const result = await service.update('activity-1', updateDto);

      expect(result).toEqual(updatedActivity);
      expect(repository.findById).toHaveBeenCalledTimes(1);
      expect(repository.findById).toHaveBeenCalledWith('activity-1');
      expect(repository.update).toHaveBeenCalledTimes(1);
      expect(repository.update).toHaveBeenCalledWith('activity-1', updateDto);
    });

    it('should throw NotFoundException when trying to update non-existent activity', async () => {
      const updateDto: UpdateActivityDto = {
        points: 20,
      };

      repository.findById.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(
        'Activity with id non-existent-id not found',
      );
      expect(repository.findById).toHaveBeenCalledWith('non-existent-id');
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete an existing activity', async () => {
      repository.findById.mockResolvedValue(mockActivity);
      repository.delete.mockResolvedValue(mockActivity);

      const result = await service.delete('activity-1');

      expect(result).toEqual(mockActivity);
      expect(repository.findById).toHaveBeenCalledTimes(1);
      expect(repository.findById).toHaveBeenCalledWith('activity-1');
      expect(repository.delete).toHaveBeenCalledTimes(1);
      expect(repository.delete).toHaveBeenCalledWith('activity-1');
    });

    it('should throw NotFoundException when trying to delete non-existent activity', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.delete('non-existent-id')).rejects.toThrow(
        'Activity with id non-existent-id not found',
      );
      expect(repository.findById).toHaveBeenCalledWith('non-existent-id');
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should return paginated list of activities', async () => {
      const filterDto: FilterActivityRequestDto = {
        page: 1,
        limit: 10,
      };

      const mockPageResponse = PageResponseDto.of(
        [mockActivity],
        1,
        10,
        1,
      );

      repository.list.mockResolvedValue(mockPageResponse);

      const result = await service.list(filterDto);

      expect(result).toEqual(mockPageResponse);
      expect(repository.list).toHaveBeenCalledTimes(1);
      expect(repository.list).toHaveBeenCalledWith(filterDto);
    });

    it('should return filtered list by lessonId', async () => {
      const filterDto: FilterActivityRequestDto = {
        page: 1,
        limit: 10,
        lessonId: 'lesson-1',
      };

      const mockPageResponse = PageResponseDto.of(
        [mockActivity],
        1,
        10,
        1,
      );

      repository.list.mockResolvedValue(mockPageResponse);

      const result = await service.list(filterDto);

      expect(result).toEqual(mockPageResponse);
      expect(repository.list).toHaveBeenCalledWith(filterDto);
    });

    it('should return filtered list by type', async () => {
      const filterDto: FilterActivityRequestDto = {
        page: 1,
        limit: 10,
        type: ActivityType.quiz,
      };

      const mockPageResponse = PageResponseDto.of(
        [mockActivity],
        1,
        10,
        1,
      );

      repository.list.mockResolvedValue(mockPageResponse);

      const result = await service.list(filterDto);

      expect(result).toEqual(mockPageResponse);
      expect(repository.list).toHaveBeenCalledWith(filterDto);
    });

    it('should return empty list when no activities match', async () => {
      const filterDto: FilterActivityRequestDto = {
        page: 1,
        limit: 10,
        search: 'non-existent',
      };

      const mockPageResponse = PageResponseDto.of(
        [],
        1,
        10,
        0,
      );

      repository.list.mockResolvedValue(mockPageResponse);

      const result = await service.list(filterDto);

      expect(result).toEqual(mockPageResponse);
      expect(result.data).toEqual([]);
      expect(result.totalItems).toBe(0);
      expect(repository.list).toHaveBeenCalledWith(filterDto);
    });
  });

  describe('ensureExists (private method)', () => {
    it('should not throw when activity exists', async () => {
      repository.findById.mockResolvedValue(mockActivity);

      // Test indirectly through update
      await expect(service.update('activity-1', { points: 20 })).resolves.not.toThrow();
    });

    it('should throw NotFoundException when activity does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      // Test indirectly through update
      await expect(service.update('non-existent-id', { points: 20 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
