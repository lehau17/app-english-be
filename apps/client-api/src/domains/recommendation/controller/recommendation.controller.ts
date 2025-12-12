import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Req,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import {
    CreateRecommendationDto,
    RecommendationResponseDto,
} from '../dto';
import { RecommendationGenerationService } from '../service/recommendation-generation.service';
import { RecommendationService } from '../service/recommendation.service';

@ApiTags('Recommendations')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/recommendations')
export class RecommendationController {
  constructor(
    private readonly service: RecommendationService,
    private readonly generationService: RecommendationGenerationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new recommendation (admin/system)' })
  @ApiResponse({ status: 201, type: RecommendationResponseDto })
  async create(@Body() dto: CreateRecommendationDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get recommendations for current user' })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'viewed', required: false, type: Boolean })
  @ApiQuery({ name: 'dismissed', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [RecommendationResponseDto] })
  async findByUserId(
    @Req() req,
    @Query('type') type?: string,
    @Query('viewed') viewed?: string,
    @Query('dismissed') dismissed?: string,
  ) {
    const userId = req.user.id;
    const filters = {
      ...(type && { type }),
      ...(viewed !== undefined && { viewed: viewed === 'true' }),
      ...(dismissed !== undefined && { dismissed: dismissed === 'true' }),
    };
    return this.service.findByUserId(userId, filters);
  }

  @Post(':id/view')
  @ApiOperation({ summary: 'Mark recommendation as viewed' })
  @ApiResponse({ status: 200, type: RecommendationResponseDto })
  async markAsViewed(@Param('id') id: string, @Req() req) {
    const userId = req.user.id;
    return this.service.markAsViewed(id, userId);
  }

  @Post(':id/click')
  @ApiOperation({ summary: 'Mark recommendation as clicked' })
  @ApiResponse({ status: 200, type: RecommendationResponseDto })
  async markAsClicked(@Param('id') id: string, @Req() req) {
    const userId = req.user.id;
    return this.service.markAsClicked(id, userId);
  }

  @Post(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss recommendation' })
  @ApiResponse({ status: 200, type: RecommendationResponseDto })
  async dismiss(@Param('id') id: string, @Req() req) {
    const userId = req.user.id;
    return this.service.dismiss(id, userId);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate personalized recommendations for current user' })
  @ApiResponse({ status: 201, description: 'Array of recommendation IDs' })
  async generate(
    @Req() req,
    @Body() body?: { limit?: number },
  ) {
    const userId = req.user.id;
    const limit = body?.limit || 10;
    const recommendationIds = await this.generationService.generateForUser(userId, limit);
    return { recommendationIds, count: recommendationIds.length };
  }
}







