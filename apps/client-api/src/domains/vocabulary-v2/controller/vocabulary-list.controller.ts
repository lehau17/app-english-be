import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import {
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
    GetVocabularyListsQueryDto,
    PaginatedVocabularyListsResponseDto,
    VocabularyListResponseDto,
} from '../dto/vocabulary-list.dto';
import { VocabularyListService } from '../service/vocabulary-list.service';

@ApiTags('Vocabulary Lists')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/vocabulary/lists')
export class VocabularyListController {
    constructor(private readonly listService: VocabularyListService) { }

    @Get()
    @ApiOperation({ summary: 'Browse public vocabulary lists' })
    @ApiResponse({ status: 200, type: PaginatedVocabularyListsResponseDto })
    @ResponseMessage('Vocabulary lists retrieved successfully')
    async getLists(
        @Query() query: GetVocabularyListsQueryDto,
        @PayloadToken() user: JwtPayload,
    ): Promise<PaginatedVocabularyListsResponseDto> {
        return this.listService.getPublicLists(query, user.sub);
    }

    @Get('my')
    @ApiOperation({ summary: "Get user's vocabulary lists" })
    @ApiResponse({ status: 200, type: [VocabularyListResponseDto] })
    @ResponseMessage("User's vocabulary lists retrieved successfully")
    async getMyLists(
        @PayloadToken() user: JwtPayload,
    ): Promise<VocabularyListResponseDto[]> {
        return this.listService.getUserLists(user.sub);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get vocabulary list by ID' })
    @ApiParam({ name: 'id', description: 'List ID' })
    @ApiResponse({ status: 200, type: VocabularyListResponseDto })
    @ResponseMessage('Vocabulary list retrieved successfully')
    async getList(
        @Param('id') id: string,
        @PayloadToken() user: JwtPayload,
    ): Promise<VocabularyListResponseDto> {
        return this.listService.getList(id, user.sub);
    }

    @Post(':id/add')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Add list to my collection' })
    @ApiParam({ name: 'id', description: 'List ID' })
    @ResponseMessage('List added to your collection successfully')
    async addToMyLists(
        @Param('id') id: string,
        @PayloadToken() user: JwtPayload,
    ): Promise<{ message: string }> {
        await this.listService.addListToUser(user.sub, id);
        return { message: 'List added successfully' };
    }

    @Delete(':id/remove')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Remove list from my collection' })
    @ApiParam({ name: 'id', description: 'List ID' })
    @ResponseMessage('List removed from your collection successfully')
    async removeFromMyLists(
        @Param('id') id: string,
        @PayloadToken() user: JwtPayload,
    ): Promise<{ message: string }> {
        await this.listService.removeListFromUser(user.sub, id);
        return { message: 'List removed successfully' };
    }
}



