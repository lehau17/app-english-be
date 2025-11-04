import { Test, TestingModule } from '@nestjs/testing';
import { PodcastRatingController } from './podcast-rating.controller';
import { PodcastRatingService } from './podcast-rating.service';
import { CreatePodcastRatingDto } from './podcast-rating.dto';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';

const mockPodcastRatingService = {
  createOrUpdate: jest.fn(),
  getAggregatedForPodcast: jest.fn(),
  listRatings: jest.fn(),
  getByUserAndPodcast: jest.fn(),
  hasUserRated: jest.fn(),
  deleteRating: jest.fn(),
};

describe('PodcastRatingController', () => {
  let controller: PodcastRatingController;
  let service: typeof mockPodcastRatingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PodcastRatingController],
      providers: [
        {
          provide: PodcastRatingService,
          useValue: mockPodcastRatingService,
        },
      ],
    }).compile();

    controller = module.get<PodcastRatingController>(PodcastRatingController);
    service = module.get(PodcastRatingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createOrUpdate', () => {
    it('should call the service to create or update a rating', async () => {
      const dto: CreatePodcastRatingDto = { podcastId: 'p1', overallRating: 5 };
      const payload = { sub: 'user-1' };
      await controller.createOrUpdate(dto, payload);
      expect(service.createOrUpdate).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('aggregate', () => {
    it('should call the service to get aggregated ratings', async () => {
      await controller.aggregate('p1');
      expect(service.getAggregatedForPodcast).toHaveBeenCalledWith('p1');
    });
  });

  describe('list', () => {
    it('should call the service to list ratings with default pagination', async () => {
      const result = { data: [], total: 0 };
      service.listRatings.mockResolvedValue(result);

      const response = await controller.list('p1', {});
      expect(service.listRatings).toHaveBeenCalledWith('p1', 1, 10);
      expect(response).toBeInstanceOf(PageResponseDto);
    });

    it('should call the service to list ratings with provided pagination', async () => {
      const result = { data: [], total: 0 };
      service.listRatings.mockResolvedValue(result);

      const response = await controller.list('p1', { page: '2', limit: '20' });
      expect(service.listRatings).toHaveBeenCalledWith('p1', 2, 20);
      expect(response).toBeInstanceOf(PageResponseDto);
    });
  });

  describe('myRating', () => {
    it("should call the service to get the current user's rating", async () => {
      const payload = { sub: 'user-1' };
      await controller.myRating('p1', payload);
      expect(service.getByUserAndPodcast).toHaveBeenCalledWith('user-1', 'p1');
    });
  });

  describe('hasRated', () => {
    it('should call the service to check if the user has rated', async () => {
      const payload = { sub: 'user-1' };
      await controller.hasRated('p1', payload);
      expect(service.hasUserRated).toHaveBeenCalledWith('user-1', 'p1');
    });
  });

  describe('remove', () => {
    it('should call the service to delete a rating', async () => {
      const payload = { sub: 'user-1' };
      await controller.remove('p1', payload);
      expect(service.deleteRating).toHaveBeenCalledWith('user-1', 'p1');
    });
  });
});
