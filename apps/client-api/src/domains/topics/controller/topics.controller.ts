import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtPayload, PayloadToken, Roles, RolesGuard } from '@app/shared';
import { UserRole } from '@prisma/client';
import { TopicsService } from '../service/topics.service';
import {
  CreateTopicDto,
  UpdateTopicDto,
  TopicFilterDto,
  TopicResponseDto,
  TrackTopicUsageDto,
} from '../dto/topic.dto';

@ApiTags('Topics')
@Controller('/private/v1/topics')
@ApiBearerAuth('Authorization')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all topics with filters' })
  @ApiResponse({
    status: 200,
    description: 'List of topics',
    type: [TopicResponseDto],
  })
  async getTopics(
    @Query() filters: TopicFilterDto,
  ): Promise<TopicResponseDto[]> {
    return this.topicsService.getTopics(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get topic by ID' })
  @ApiResponse({
    status: 200,
    description: 'Topic details',
    type: TopicResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getTopicById(@Param('id') id: string): Promise<TopicResponseDto> {
    return this.topicsService.getTopicById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.teacher)
  @ApiOperation({ summary: 'Create new topic (Admin/Teacher only)' })
  @ApiResponse({
    status: 201,
    description: 'Topic created',
    type: TopicResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Topic name already exists' })
  async createTopic(@Body() data: CreateTopicDto): Promise<TopicResponseDto> {
    return this.topicsService.createTopic(data);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.teacher)
  @ApiOperation({ summary: 'Update topic (Admin/Teacher only)' })
  @ApiResponse({
    status: 200,
    description: 'Topic updated',
    type: TopicResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async updateTopic(
    @Param('id') id: string,
    @Body() data: UpdateTopicDto,
  ): Promise<TopicResponseDto> {
    return this.topicsService.updateTopic(id, data);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete topic (Admin only)' })
  @ApiResponse({ status: 204, description: 'Topic deleted' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async deleteTopic(@Param('id') id: string): Promise<void> {
    return this.topicsService.deleteTopic(id);
  }

  @Post('track-usage')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Track topic usage when starting a session' })
  @ApiResponse({ status: 200, description: 'Usage tracked successfully' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async trackUsage(
    @Body() data: TrackTopicUsageDto,
    @PayloadToken() payload: JwtPayload,
  ): Promise<{ message: string }> {
    await this.topicsService.trackUsage(data.topicId, payload.sub);
    return { message: 'Topic usage tracked successfully' };
  }
}
