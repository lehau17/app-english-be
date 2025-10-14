import { AccessTokenGuard, ResponseMessage, Roles } from '@app/shared';
import { RequestContext } from '@app/shared/request-context';
import {
  Controller,
  Get,
  Query,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetTransactionsQueryDto } from '../dto/get-transactions-query.dto';
import { ParentTransactionService } from '../service/parent-transaction.service';

@ApiTags('Parent')
@ApiBearerAuth('Authorization')
@Controller('/api/v1/parent/transactions')
@UseGuards(AccessTokenGuard)
export class PrivateParentTransactionController {
  constructor(
    private readonly parentTransactionService: ParentTransactionService,
  ) {}

  @Get()
  @Roles('PARENT')
  @ApiOperation({ summary: "Get children's transaction history" })
  @ResponseMessage('Transaction history fetched successfully')
  getTransactions(@Query() query: GetTransactionsQueryDto) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.parentTransactionService.getParentTransactions(user.sub, query);
  }
}
