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
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ParentChildrenGradesDto } from '../../gradebook/dto';
import {
  GradebookExportService,
  GradebookService,
} from '../../gradebook/service';
import { UpdateParentChildSettingsDto } from '../dto';
import {
  CreateParentRewardDto,
  UpdateParentRewardDto,
} from '../dto/parent-reward.dto';
import { ParentService } from '../service/parent.service';

@ApiTags('Parent')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/parent')
export class PrivateParentController {
  constructor(
    private readonly parentService: ParentService,
    private readonly gradebookService: GradebookService,
    private readonly gradebookExportService: GradebookExportService,
  ) {}

  /**
   * Sanitize filename to remove invalid characters for HTTP headers
   */
  private sanitizeFilename(name: string): string {
    if (!name) return 'unknown';
    return name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove invalid chars
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/[^\w\-._]/g, '') // Keep only alphanumeric, dash, dot, underscore
      .substring(0, 100); // Limit length
  }

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

  @Get('children/grades')
  @ApiOperation({ summary: 'Get grades for all children' })
  @ResponseMessage('Children grades fetched successfully')
  getChildrenGrades(): Promise<ParentChildrenGradesDto> {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.gradebookService.getParentChildrenGrades(user.sub);
  }

  @Get('children/grades/export')
  @ApiOperation({ summary: 'Export children grades to Excel' })
  @ResponseMessage('Children grades exported successfully')
  async exportChildrenGrades(@Res() res: Response): Promise<void> {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    const buffer = await this.gradebookExportService.exportParentChildrenGrades(
      user.sub,
    );

    const filename = `bang-diem-cac-con-${Date.now()}.xlsx`;
    const encodedFilename = encodeURIComponent(filename);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    });

    res.send(buffer);
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
    @Query('limit') limit?: number,
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
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getActivities(user.sub, {
      page,
      limit,
      childId,
      type,
      status,
      from,
      to,
    });
  }

  @Get('children/:childId/settings')
  @ApiOperation({ summary: 'Get notification settings for child' })
  @ResponseMessage('Child settings fetched successfully')
  getChildSettings(@Param('childId', new ParseUUIDPipe()) childId: string) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getChildSettings(user.sub, childId);
  }

  @Patch('children/:childId/settings')
  @ApiOperation({
    summary: 'Update notification and monitoring settings for child',
  })
  @ResponseMessage('Child settings updated successfully')
  updateChildSettings(
    @Param('childId', new ParseUUIDPipe()) childId: string,
    @Body() dto: UpdateParentChildSettingsDto,
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
    @Query('limit') limit?: number,
  ) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getChildProgress(user.sub, childId, {
      from,
      to,
      page,
      limit,
    });
  }

  @Get('unpaid-classrooms')
  @ApiOperation({ summary: 'Get unpaid classrooms for children' })
  @ResponseMessage('Unpaid classrooms fetched successfully')
  getUnpaidClassrooms() {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getUnpaidClassrooms(user.sub);
  }

  @Get('payment-summary')
  @ApiOperation({ summary: 'Get payment summary for all children' })
  @ResponseMessage('Payment summary fetched successfully')
  getPaymentSummary() {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getPaymentSummary(user.sub);
  }

  @Get('learning-paths/overview')
  @ApiOperation({
    summary: 'Get learning paths overview for all children',
  })
  @ResponseMessage('Learning paths overview fetched successfully')
  getLearningPathsOverview() {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getAllChildrenLearningPathsOverview(user.sub);
  }

  @Get('children/:childId/learning-paths')
  @ApiOperation({ summary: 'Get all learning paths for a child' })
  @ResponseMessage('Child learning paths fetched successfully')
  getChildLearningPaths(
    @Param('childId', new ParseUUIDPipe()) childId: string,
    @Query('isCompleted') isCompleted?: boolean,
  ) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    const filters = isCompleted !== undefined ? { isCompleted } : undefined;
    return this.parentService.getChildLearningPaths(user.sub, childId, filters);
  }

  @Get('children/:childId/learning-paths/active')
  @ApiOperation({ summary: 'Get active learning path for a child' })
  @ResponseMessage('Active learning path fetched successfully')
  getChildActiveLearningPath(
    @Param('childId', new ParseUUIDPipe()) childId: string,
  ) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getChildActiveLearningPath(user.sub, childId);
  }

  @Get('children/:childId/learning-paths/:pathId')
  @ApiOperation({ summary: 'Get learning path detail for a child' })
  @ResponseMessage('Learning path detail fetched successfully')
  getChildLearningPathDetail(
    @Param('childId', new ParseUUIDPipe()) childId: string,
    @Param('pathId', new ParseUUIDPipe()) pathId: string,
  ) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getChildLearningPathDetail(
      user.sub,
      childId,
      pathId,
    );
  }

  @Get('children/:childId/learning-paths/:pathId/progress')
  @ApiOperation({ summary: 'Get learning path progress for a child' })
  @ResponseMessage('Learning path progress fetched successfully')
  getChildLearningPathProgress(
    @Param('childId', new ParseUUIDPipe()) childId: string,
    @Param('pathId', new ParseUUIDPipe()) pathId: string,
  ) {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new Error('User not authenticated');
    }

    return this.parentService.getChildLearningPathProgress(
      user.sub,
      childId,
      pathId,
    );
  }
}
