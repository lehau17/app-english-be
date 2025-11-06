import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import {
    Controller,
    Get,
    Query,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { GetUserAttemptsQueryDto } from '../dto/podcast.dto';
import { PodcastService } from '../service/podcast.service';

@ApiTags('Podcast Attempts')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/podcast-attempts')
export class PodcastAttemptController {
    constructor(private readonly podcastService: PodcastService) {}

    @Get('my-history')
    @ApiOperation({
        summary: 'Get all podcast attempts for current user',
        description:
            'Retrieve learning history with all podcast attempts for the authenticated user',
    })
    @ResponseMessage('User attempts history retrieved successfully')
    async getMyHistory(
        @PayloadToken() payload: JwtPayload,
        @Query() query: GetUserAttemptsQueryDto,
    ) {
        const userId = payload.sub;
        return this.podcastService.getAllUserAttempts(userId, query);
    }
}

