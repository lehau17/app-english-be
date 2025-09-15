import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  CreateActivityDto,
  GetActivitiesQueryDto,
  UpdateActivityDto,
} from '../dto/podcast-activity.dto';
import { GetAttemptsQueryDto, SubmitAttemptDto } from '../dto/user-activity-attempt.dto';
import { PodcastActivityEntity } from '../entities/podcast-activity.entity';
import { PodcastActivityService } from '../service/podcast-activity.service';

@ApiTags('Podcast Activities')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/podcast-activities')
export class PodcastActivityController {
  constructor(private readonly activityService: PodcastActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Get activities by podcast' })
  @ResponseMessage('Activities retrieved successfully')
  async getActivitiesByPodcast(
    @Query() query: GetActivitiesQueryDto,
    @PayloadToken() payload: JwtPayload,
  ): Promise<PageResponseDto<PodcastActivityEntity>> {
    return this.activityService.findByPodcast(query.podcastId, payload.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get activity by ID' })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ResponseMessage('Activity retrieved successfully')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @PayloadToken() payload: JwtPayload) {
    return this.activityService.findOne(id, payload.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new activity' })
  @ResponseMessage('Activity created successfully')
  async create(@Body() createActivityDto: CreateActivityDto, @PayloadToken() payload: JwtPayload) {
    return this.activityService.create(createActivityDto, payload.sub);
  }

  @Post(':id')
  @ApiOperation({ summary: 'Update activity' })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ResponseMessage('Activity updated successfully')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateActivityDto: UpdateActivityDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.activityService.update(id, updateActivityDto, payload.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete activity' })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ResponseMessage('Activity deleted successfully')
  async remove(@Param('id', ParseUUIDPipe) id: string, @PayloadToken() payload: JwtPayload) {
    return this.activityService.remove(id, payload.sub);
  }

  // ===================== USER ATTEMPTS ENDPOINTS =====================

  @Post(':id/attempt')
  @ApiOperation({ summary: 'Submit attempt for activity' })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ResponseMessage('Attempt submitted successfully')
  async submitAttempt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() submitAttemptDto: SubmitAttemptDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.activityService.submitAttempt(id, payload.sub, submitAttemptDto);
  }

  @Get(':id/attempts')
  @ApiOperation({ summary: 'Get user attempts for activity' })
  @ApiParam({ name: 'id', description: 'Activity ID' })
  @ResponseMessage('Attempts retrieved successfully')
  async getUserAttempts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetAttemptsQueryDto,
    @PayloadToken() payload: JwtPayload
  ): Promise<PageResponseDto<any>> {
    return this.activityService.getAttempts(id, payload.sub, query);
  }
}
