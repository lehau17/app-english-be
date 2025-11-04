import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetTransactionsQueryDto } from '../dto/get-transactions-query.dto';
import { ParentTransactionService } from '../service/parent-transaction.service';

@ApiTags('Parent')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/parent/transactions')
export class PrivateParentTransactionController {
  constructor(
    private readonly parentTransactionService: ParentTransactionService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get children's transaction history" })
  @ResponseMessage('Transaction history fetched successfully')
  getTransactions(
    @Query() query: GetTransactionsQueryDto,
    @PayloadToken() user: JwtPayload,
  ) {
    return this.parentTransactionService.getParentTransactions(user.sub, query);
  }
}
