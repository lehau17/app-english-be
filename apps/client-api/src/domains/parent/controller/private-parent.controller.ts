import { ResponseMessage } from '@app/shared';
import { RequestContext } from '@app/shared/request-context';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Put,
    Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateParentChildSettingsDto } from '../dto';
import { CreateParentRewardDto, UpdateParentRewardDto } from '../dto/parent-reward.dto';
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

  @Get('children')
  @ApiOperation({ summary: 'Get children of parent' })
  @ResponseMessage('Children list fetched successfully')
  getChildren() {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getChildren(user.sub);
  }

  @Get('rewards')
  @ApiOperation({ summary: 'Get parent custom rewards' })
  @ResponseMessage('Rewards list fetched successfully')
  getRewards() {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getRewards(user.sub);
  }

  @Post('rewards')
  @ApiOperation({ summary: 'Create a custom reward for a child' })
  @ResponseMessage('Reward created successfully')
  createReward(@Body() dto: CreateParentRewardDto) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }
    return this.parentService.createReward(user.sub, dto);
  }

  @Put('rewards/:rewardId')
  @ApiOperation({ summary: 'Update a custom reward' })
  @ResponseMessage('Reward updated successfully')
  updateReward(
    @Param('rewardId', new ParseUUIDPipe()) rewardId: string,
    @Body() dto: UpdateParentRewardDto,
  ) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }
    return this.parentService.updateReward(user.sub, rewardId, dto);
  }

  @Delete('rewards/:rewardId')
  @ApiOperation({ summary: 'Delete a custom reward' })
  @ResponseMessage('Reward deleted successfully')
  deleteReward(@Param('rewardId', new ParseUUIDPipe()) rewardId: string) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }
    return this.parentService.deleteReward(user.sub, rewardId);
  }

  @Patch('rewards/:rewardId/toggle')
  @ApiOperation({ summary: 'Toggle active state for a reward' })
  @ResponseMessage('Reward toggled successfully')
  toggleReward(@Param('rewardId', new ParseUUIDPipe()) rewardId: string) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }
    return this.parentService.toggleReward(user.sub, rewardId);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get parent notifications (paginated)' })
  @ResponseMessage('Notifications list fetched successfully')
  getNotifications(
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getNotifications(user.sub, { page, limit });
  }

  @Get('activities')
  @ApiOperation({ summary: 'Get children activities for parent' })
  @ResponseMessage('Children activities fetched successfully')
  getActivities(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('childId') childId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string
  ) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getActivities(user.sub, { page, limit, childId, type, status });
  }

  @Get('children/:childId/settings')
  @ApiOperation({ summary: 'Get notification settings for child' })
  @ResponseMessage('Child settings fetched successfully')
  getChildSettings(
    @Param('childId', new ParseUUIDPipe()) childId: string
  ) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getChildSettings(user.sub, childId);
  }

  @Patch('children/:childId/settings')
  @ApiOperation({ summary: 'Update notification and monitoring settings for child' })
  @ResponseMessage('Child settings updated successfully')
  updateChildSettings(
    @Param('childId', new ParseUUIDPipe()) childId: string,
    @Body() dto: UpdateParentChildSettingsDto
  ) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.updateChildSettings(user.sub, childId, dto);
  }

  @Get('children/:childId/progress')
  @ApiOperation({ summary: 'Get child progress history' })
  @ResponseMessage('Child progress fetched successfully')
  getChildProgress(
    @Param('childId', new ParseUUIDPipe()) childId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getChildProgress(user.sub, childId, { from, to, page, limit });
  }
}
