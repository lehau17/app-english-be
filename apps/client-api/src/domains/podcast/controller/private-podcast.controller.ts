import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreatePodcastDto,
  GetPodcastsQueryDto,
  UpdatePodcastDto,
} from '../dto/podcast.dto';
import {
  CreateRatingDto,
  GetRatingsQueryDto,
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
  async findAll(
    @PayloadToken() payload: JwtPayload,
    @Query() query: GetPodcastsQueryDto,
  ) {
    const userId = payload.sub;
    return this.podcastService.findAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get podcast by ID' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Podcast retrieved successfully')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @PayloadToken() _payload: JwtPayload,
  ) {
    return this.podcastService.getPodcastById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new podcast' })
  @ResponseMessage('Podcast created successfully')
  async create(
    @Body() createPodcastDto: CreatePodcastDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.createPodcast(createPodcastDto, payload.sub);
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
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.remove(id, payload.sub);
  }

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
  async getRatings(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetRatingsQueryDto,
  ): Promise<PageResponseDto<any>> {
    return this.podcastService.getRatings(id, query);
  }

  @Post(':id/start')
  async startPodcast(
    @Param('id') id: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.startPodcastAttempt(id, payload.sub);
  }

  @Post(':id/submit')
  async submitAttempt(
    @Param('id') podcastId: string,
    @Body() body: { attemptId: string; answers: Record<string, string> },
  ) {
    return this.podcastService.submitPodcastAttempt(
      podcastId,
      body.attemptId,
      body.answers,
    );
  }

  @Post(':id/save-draft')
  async saveDraft(
    @Param('id') podcastId: string,
    @Body()
    body: {
      attemptId: string;
      answers: Record<string, string>;
      timeSpent?: number;
    },
  ) {
    return this.podcastService.saveDraft(
      podcastId,
      body.attemptId,
      body.answers,
      body.timeSpent,
    );
  }

  @Get(':id/attempts')
  async getAttempts(
    @Param('id') podcastId: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    const userId = payload.sub;
    return this.podcastService.getPodcastAttempts(podcastId, userId);
  }
}
