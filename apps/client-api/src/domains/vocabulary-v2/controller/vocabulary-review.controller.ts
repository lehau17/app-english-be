import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
    GetDueCardsQueryDto,
    ReviewSessionResponseDto,
    ReviewStatsDto,
    StartReviewSessionDto,
    SubmitReviewDto,
    SubmitReviewResponseDto,
} from '../dto/review.dto';
import { VocabularyTermResponseDto } from '../dto/vocabulary-term.dto';
import { ReviewService } from '../service/review.service';

@ApiTags('Vocabulary Review')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/vocabulary/review')
export class VocabularyReviewController {
    constructor(private readonly reviewService: ReviewService) { }

    @Get('session')
    @ApiOperation({ summary: 'Start a review session' })
    @ApiResponse({ status: 200, type: ReviewSessionResponseDto })
    @ResponseMessage('Review session started successfully')
    async startSession(
        @Query() dto: StartReviewSessionDto,
        @PayloadToken() user: JwtPayload,
    ): Promise<ReviewSessionResponseDto> {
        return this.reviewService.startSession(user.sub, dto);
    }

    @Post('submit')
    @ApiOperation({ summary: 'Submit review results' })
    @ApiResponse({ status: 200, type: SubmitReviewResponseDto })
    @ResponseMessage('Review submitted successfully')
    async submitReview(
        @Body() dto: SubmitReviewDto,
        @PayloadToken() user: JwtPayload,
    ): Promise<SubmitReviewResponseDto> {
        return this.reviewService.submitReview(user.sub, dto);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get review statistics' })
    @ApiResponse({ status: 200, type: ReviewStatsDto })
    @ResponseMessage('Statistics retrieved successfully')
    async getStats(
        @Query('listId') listId: string | undefined,
        @PayloadToken() user: JwtPayload,
    ): Promise<ReviewStatsDto> {
        return this.reviewService.getStats(user.sub, listId);
    }

    @Get('due')
    @ApiOperation({ summary: 'Get due cards' })
    @ApiResponse({ status: 200, type: [VocabularyTermResponseDto] })
    @ResponseMessage('Due cards retrieved successfully')
    async getDueCards(
        @Query() query: GetDueCardsQueryDto,
        @PayloadToken() user: JwtPayload,
    ): Promise<VocabularyTermResponseDto[]> {
        return this.reviewService.getDueCards(user.sub, query);
    }
}



