import { Test, TestingModule } from '@nestjs/testing';
import { AdminTransactionService } from '../admin-transaction.service';
import { AdminTransactionRepository } from '../repository/admin-transaction.repository';
import { NotFoundException } from '@nestjs/common';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';

const mockRepository = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  getStats: jest.fn(),
};

describe('AdminTransactionService', () => {
  let service: AdminTransactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTransactionService,
        {
          provide: AdminTransactionRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AdminTransactionService>(AdminTransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should call repository.findAll with correct filter', async () => {
      const filter: TransactionFilterDto = { page: 1, limit: 10 };
      const result = { data: [], total: 0, page: 1, limit: 10 };
      mockRepository.findAll.mockResolvedValue(result);

      await service.findAll(filter);
      expect(mockRepository.findAll).toHaveBeenCalledWith(filter);
    });
  });

  describe('findOne', () => {
    it('should return a transaction when found', async () => {
      const transactionId = 'some-id';
      const mockTransaction = { id: transactionId, amount: 100 };
      mockRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.findOne(transactionId);
      expect(result).toEqual(mockTransaction);
      expect(mockRepository.findOne).toHaveBeenCalledWith(transactionId);
    });

    it('should throw NotFoundException when transaction is not found', async () => {
      const transactionId = 'not-found-id';
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(transactionId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('should call repository.getStats', async () => {
      const stats = { totalRevenueToday: 1000 };
      mockRepository.getStats.mockResolvedValue(stats);

      await service.getStats();
      expect(mockRepository.getStats).toHaveBeenCalled();
    });
  });
});