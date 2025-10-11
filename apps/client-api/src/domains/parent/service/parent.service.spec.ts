import { Test, TestingModule } from '@nestjs/testing';
import { ParentService } from './parent.service';
import { PrismaRepository } from '@app/database';
import { ParentChildService } from '../../parent-child/service/parent-child.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateParentRewardDto } from '../dto/parent-reward.dto';

// Mock data
const mockUser = {
  sub: 'user-id-1',
  role: 'parent',
};

const mockParentChildRelation = {
  parentId: mockUser.sub,
  childId: 'child-id-1',
};

describe('ParentService', () => {
  let service: ParentService;
  let prisma: PrismaRepository;
  let parentChildService: ParentChildService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentService,
        {
          provide: PrismaRepository,
          useValue: {
            parentChild: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
            customReward: {
              findMany: jest.fn(),
              create: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
            },
            notification: {
              findMany: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ParentChildService,
          useValue: {
            // Mock any methods from ParentChildService that are used in ParentService
          },
        },
      ],
    }).compile();

    service = module.get<ParentService>(ParentService);
    prisma = module.get<PrismaRepository>(PrismaRepository);
    parentChildService = module.get<ParentChildService>(ParentChildService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getParentDashboard', () => {
    it('should return dashboard data for a parent', async () => {
      const mockDashboardData = {
        parentChild: {
          findMany: jest.fn().mockResolvedValue([
            {
              child: {
                id: 'child-id-1',
                displayName: 'Test Child',
                avatarUrl: 'http://example.com/avatar.png',
                Profile: { currentLevel: '5', totalStudyTime: 60 },
                Progress: [{ state: 'done' }],
                lastActiveAt: new Date(),
              },
            },
          ]),
        },
        customReward: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        notification: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      (prisma as any).parentChild.findMany = mockDashboardData.parentChild.findMany;
      (prisma as any).customReward.findMany = mockDashboardData.customReward.findMany;
      (prisma as any).notification.findMany = mockDashboardData.notification.findMany;

      const result = await service.getParentDashboard(mockUser.sub);

      expect(result.children.length).toBe(1);
      expect(result.children[0].name).toBe('Test Child');
      expect(result.totalStudyTime).toBe(60);
      expect(prisma.parentChild.findMany).toHaveBeenCalledWith({
        where: { parentId: mockUser.sub },
        include: expect.any(Object),
      });
    });
  });

  describe('createReward', () => {
    const rewardDto: CreateParentRewardDto = {
      targetChildId: 'child-id-1',
      title: 'New Reward',
      description: 'A test reward',
      type: 'activity' as any,
      cost: 100,
      imageUrl: 'http://example.com/reward.png',
    };

    it('should create a reward successfully', async () => {
      (prisma.parentChild.findUnique as jest.Mock).mockResolvedValue(mockParentChildRelation);
      (prisma.customReward.create as jest.Mock).mockResolvedValue({ id: 'reward-id-1', ...rewardDto });

      const result = await service.createReward(mockUser.sub, rewardDto);

      expect(result).toEqual({ id: 'reward-id-1' });
      expect(prisma.parentChild.findUnique).toHaveBeenCalledWith({
        where: { parentId_childId: { parentId: mockUser.sub, childId: rewardDto.targetChildId } },
      });
      expect(prisma.customReward.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if parent-child relationship does not exist', async () => {
      (prisma.parentChild.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createReward(mockUser.sub, rewardDto)).rejects.toThrow(NotFoundException);
    });
  });
});