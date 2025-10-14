import { AccessTokenGuard, RolesGuard } from '@app/shared/guard';
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminTransactionService } from './admin-transaction.service';
import { TransactionFilterDto } from './dto/transaction-filter.dto';
import { Roles } from '@app/shared/decorator/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Admin-Transaction')
@ApiBearerAuth()
@Roles(UserRole.admin)
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller({
  path: 'admin/transactions',
  version: '1',
})
export class AdminTransactionController {
  constructor(
    private readonly adminTransactionService: AdminTransactionService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Lấy danh sách giao dịch thành công' })
  findAll(@Query(new ValidationPipe({ transform: true })) filter: TransactionFilterDto) {
    return this.adminTransactionService.findAll(filter);
  }

  @Get('stats')
  @ApiOkResponse({ description: 'Lấy thống kê giao dịch thành công' })
  getStats() {
    return this.adminTransactionService.getStats();
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Lấy chi tiết giao dịch thành công' })
  findOne(@Param('id') id: string) {
    return this.adminTransactionService.findOne(id);
  }
}