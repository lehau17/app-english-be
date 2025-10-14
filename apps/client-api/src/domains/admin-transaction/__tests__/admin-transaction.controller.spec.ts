import { Test, TestingModule } from '@nestjs/testing';
import { AdminTransactionController } from '../admin-transaction.controller';
import { AdminTransactionService } from '../admin-transaction.service';
import { AccessTokenGuard, RolesGuard } from '@app/shared/guard';
import { Reflector } from '@nestjs/core';
import { TokenRepository } from '@app/shared';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  getStats: jest.fn(),
};

const mockTokenRepository = {
  decodeToken: jest.fn(),
};

describe('AdminTransactionController', () => {
  let controller: AdminTransactionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminTransactionController],
      providers: [
        {
          provide: AdminTransactionService,
          useValue: mockService,
        },
        // Cung cấp các Guard và phụ thuộc của chúng
        {
          provide: AccessTokenGuard,
          useValue: { canActivate: jest.fn(() => true) }, // Mock AccessTokenGuard
        },
        {
          provide: RolesGuard,
          useValue: { canActivate: jest.fn(() => true) }, // Mock RolesGuard
        },
        Reflector, // Cung cấp Reflector thực sự vì RolesGuard có thể phụ thuộc vào nó
        {
          provide: TokenRepository,
          useValue: mockTokenRepository,
        },
      ],
    }).compile();

    controller = module.get<AdminTransactionController>(
      AdminTransactionController,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll with filter', () => {
      const filter: TransactionFilterDto = { page: 1, limit: 10 };
      controller.findAll(filter);
      expect(mockService.findAll).toHaveBeenCalledWith(filter);
    });
  });

  describe('getStats', () => {
    it('should call service.getStats', () => {
      controller.getStats();
      expect(mockService.getStats).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id', () => {
      const id = 'some-id';
      controller.findOne(id);
      expect(mockService.findOne).toHaveBeenCalledWith(id);
    });
  });
});