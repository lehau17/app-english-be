import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminTransactionRepository } from './repository/admin-transaction.repository';
import { TransactionFilterDto } from './dto/transaction-filter.dto';

@Injectable()
export class AdminTransactionService {
  constructor(
    private readonly adminTransactionRepository: AdminTransactionRepository,
  ) {}

  async findAll(filter: TransactionFilterDto) {
    return this.adminTransactionRepository.findAll(filter);
  }

  async findOne(id: string) {
    const transaction = await this.adminTransactionRepository.findOne(id);
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    return transaction;
  }

  async getStats() {
    return this.adminTransactionRepository.getStats();
  }
}