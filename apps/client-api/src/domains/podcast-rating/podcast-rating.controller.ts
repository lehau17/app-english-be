import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreatePodcastRatingDto,
  FilterPodcastQueryDto,
} from './podcast-rating.dto';
import { PodcastRatingService } from './podcast-rating.service';

@ApiTags('podcast-rating')
@Controller('/private/v1/podcast-ratings')
export class PodcastRatingController {
  constructor(private readonly svc: PodcastRatingService) {}

  @Post()
  @ResponseMessage('Rating saved')
  async createOrUpdate(
    @Body() payload: CreatePodcastRatingDto,
    @PayloadToken() payloadToken: JwtPayload,
  ) {
    const userId = payloadToken.sub;
    const result = await this.svc.createOrUpdate(userId, payload);
    return result;
  }

  // Public aggregated rating by podcast id
  @Get('/public/:podcastId/aggregate')
  async aggregate(@Param('podcastId') podcastId: string) {
    return this.svc.getAggregatedForPodcast(podcastId);
  }

  // Public list of ratings with pagination
  @Get('/public/:podcastId')
  async list(
    @Param('podcastId') podcastId: string,
    @Query() query: FilterPodcastQueryDto,
  ) {
    const p = parseInt(query.page as any, 10) || 1;
    const l = parseInt(query.limit as any, 10) || 10;
    const result = await this.svc.listRatings(podcastId, p, l);
    return PageResponseDto.of(result.data, p, l, result.total);
  }

  @Get('/:podcastId/me')
  async myRating(
    @Param('podcastId') podcastId: string,
    @PayloadToken() payloadToken: any,
  ) {
    const userId = payloadToken.sub;
    return this.svc.getByUserAndPodcast(userId, podcastId);
  }

  // Check if current user has rated this podcast
  @Get('/:podcastId/has-rated')
  async hasRated(
    @Param('podcastId') podcastId: string,
    @PayloadToken() payloadToken: any,
  ) {
    const userId = payloadToken.sub;
    return await this.svc.hasUserRated(userId, podcastId);
  }

  @Delete('/:podcastId')
  @ResponseMessage('Rating removed')
  async remove(
    @Param('podcastId') podcastId: string,
    @PayloadToken() payloadToken: any,
  ) {
    const userId = payloadToken.sub;
    return this.svc.deleteRating(userId, podcastId);
  }
}
