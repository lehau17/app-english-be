import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreatePodcastDto, GetPodcastsQueryDto, UpdatePodcastDto } from '../dto/podcast.dto';
import { CreatePodcastFromTextDto, GenerateActivitiesDto } from '../dto/text-to-podcast.dto';
import {
    CreateRatingDto,
    GetRatingsQueryDto,
    ToggleLikeDto,
    ToggleSaveDto,
    UpdateProgressDto,
} from '../dto/user-interaction.dto';
import { PodcastService } from '../service/podcast.service';
import { TextToPodcastService } from '../service/text-to-podcast.service';

@ApiTags('Podcasts')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/podcasts')
export class PodcastController {
  constructor(
    private readonly podcastService: PodcastService,
    private readonly textToPodcastService: TextToPodcastService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all podcasts with filtering and pagination' })
  @ResponseMessage('Podcasts retrieved successfully')
  async findAll(@PayloadToken() payload: JwtPayload, @Query() query: GetPodcastsQueryDto) {
    const userId = payload.sub;
    return this.podcastService.findAll(userId, query);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular podcasts' })
  @ResponseMessage('Popular podcasts retrieved successfully')
  async getPopular(@Query('limit') limit?: number) {
    return this.podcastService.getPopularPodcasts(limit);
  }

  @Get('recommended')
  @ApiOperation({ summary: 'Get recommended podcasts for user' })
  @ResponseMessage('Recommended podcasts retrieved successfully')
  async getRecommended(@PayloadToken() payload: JwtPayload, @Query('limit') limit?: number) {
    return this.podcastService.getRecommendedForUser(payload.sub, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get podcast by ID' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Podcast retrieved successfully')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @PayloadToken() payload: JwtPayload) {
    const userId = payload.sub;
    return this.podcastService.findOne(id, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new podcast' })
  @ResponseMessage('Podcast created successfully')
  async create(@Body() createPodcastDto: CreatePodcastDto, @PayloadToken() payload: JwtPayload) {
    return this.podcastService.create(createPodcastDto, payload.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update podcast' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Podcast updated successfully')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePodcastDto: UpdatePodcastDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.update(id, updatePodcastDto, payload.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete podcast' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Podcast deleted successfully')
  async remove(@Param('id', ParseUUIDPipe) id: string, @PayloadToken() payload: JwtPayload) {
    return this.podcastService.remove(id, payload.sub);
  }

  // ===================== USER PROGRESS ENDPOINTS =====================

  @Put(':id/progress')
  @ApiOperation({ summary: 'Update user progress for podcast' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Progress updated successfully')
  async updateProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProgressDto: UpdateProgressDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.updateProgress(id, payload.sub, updateProgressDto);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Toggle like status for podcast' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Like status updated successfully')
  async toggleLike(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() toggleLikeDto: ToggleLikeDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.toggleLike(id, payload.sub, toggleLikeDto);
  }

  @Post(':id/save')
  @ApiOperation({ summary: 'Toggle save status for podcast' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Save status updated successfully')
  async toggleSave(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() toggleSaveDto: ToggleSaveDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.toggleSave(id, payload.sub, toggleSaveDto);
  }

  // ===================== RATINGS ENDPOINTS =====================

  @Post(':id/rating')
  @ApiOperation({ summary: 'Create or update rating for podcast' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Rating submitted successfully')
  async createRating(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createRatingDto: CreateRatingDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.createRating(id, payload.sub, createRatingDto);
  }

  @Get(':id/ratings')
  @ApiOperation({ summary: 'Get ratings for podcast' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Ratings retrieved successfully')
  async getRatings(@Param('id', ParseUUIDPipe) id: string, @Query() query: GetRatingsQueryDto) {
    return this.podcastService.getRatings(id, query);
  }

  // ===================== TEXT-TO-PODCAST ENDPOINTS =====================

  @Post('from-text')
  @ApiOperation({
    summary: 'Create podcast from text with auto-generated activities',
    description: 'Convert text to speech and automatically generate listening activities like fill-in-the-blanks'
  })
  @ResponseMessage('Podcast created from text successfully')
  async createFromText(
    @Body() createFromTextDto: CreatePodcastFromTextDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.textToPodcastService.createPodcastFromText(createFromTextDto, payload.sub);
  }

  @Post(':id/generate-activities')
  @ApiOperation({
    summary: 'Generate activities for existing podcast',
    description: 'Auto-generate listening activities for a podcast that has transcript'
  })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Activities generated successfully')
  async generateActivities(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() generateActivitiesDto: GenerateActivitiesDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    // Set podcast ID from URL param
    generateActivitiesDto.podcastId = id;
    return this.textToPodcastService.generateActivitiesOnly(generateActivitiesDto, payload.sub);
  }
}
