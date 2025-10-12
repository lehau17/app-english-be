import { Test, TestingModule } from '@nestjs/testing';
import { PrivateParentController } from './private-parent.controller';
import { ParentService } from '../service/parent.service';
import { RequestContext } from '@app/shared/request-context';
import { CreateParentRewardDto } from '../dto/parent-reward.dto';

// Mock user data for RequestContext
const mockUser = {
  sub: 'user-id-1',
  role: 'parent',
};

describe('PrivateParentController', () => {
  let controller: PrivateParentController;
  let parentService: ParentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrivateParentController],
      providers: [
        {
          provide: ParentService,
          useValue: {
            getParentDashboard: jest.fn(),
            createReward: jest.fn(),
            // Mock other methods as needed
          },
        },
      ],
    }).compile();

    controller = module.get<PrivateParentController>(PrivateParentController);
    parentService = module.get<ParentService>(ParentService);

    // Mock RequestContext
    jest.spyOn(RequestContext, 'getValue').mockReturnValue(mockUser);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should call parentService.getParentDashboard with the correct user id', async () => {
      const dashboardData = { children: [], rewards: [], notifications: [], totalStudyTime: 0, completionRate: 0 };
      (parentService.getParentDashboard as jest.Mock).mockResolvedValue(dashboardData);

      const result = await controller.getDashboard();

      expect(parentService.getParentDashboard).toHaveBeenCalledWith(mockUser.sub);
      expect(result).toBe(dashboardData);
    });
  });

  describe('createReward', () => {
    it('should call parentService.createReward with the correct parameters', async () => {
      const dto: CreateParentRewardDto = {
        targetChildId: 'child-id-1',
        title: 'New Reward',
        description: 'A test reward',
        type: 'activity' as any,
        cost: 100,
        imageUrl: 'http://example.com/reward.png',
      };
      const createdReward = { id: 'reward-id-1' };
      (parentService.createReward as jest.Mock).mockResolvedValue(createdReward);

      const result = await controller.createReward(dto);

      expect(parentService.createReward).toHaveBeenCalledWith(mockUser.sub, dto);
      expect(result).toBe(createdReward);
    });
  });
});