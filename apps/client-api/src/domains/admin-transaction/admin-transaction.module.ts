import { Module } from '@nestjs/common';
import { AdminTransactionController } from './admin-transaction.controller';
import { AdminTransactionService } from './admin-transaction.service';
import { AdminTransactionRepository } from './repository/admin-transaction.repository';

@Module({
  controllers: [AdminTransactionController],
  providers: [AdminTransactionService, AdminTransactionRepository],
})
export class AdminTransactionModule {}