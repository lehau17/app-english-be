import { ResponseMessage } from '@app/shared';
import { RequestContext } from '@app/shared/request-context';
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParentService } from '../service/parent.service';

@ApiTags('Parent')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/parent')
export class PrivateParentController {
  constructor(private readonly parentService: ParentService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get parent dashboard data' })
  @ResponseMessage('Parent dashboard data fetched successfully')
  getDashboard() {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getParentDashboard(user.sub);
  }
}
