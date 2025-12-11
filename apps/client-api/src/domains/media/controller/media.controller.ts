import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MediaFileResponseDto, MediaFileQueryDto, MediaSearchQueryDto } from '../dto/media.dto';
import { MediaService } from '../service/media.service';

@ApiTags('Media')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @ApiOperation({ summary: 'List media files with filters' })
  async list(
    @Query() query: MediaFileQueryDto,
  ): Promise<{ data: MediaFileResponseDto[]; total: number; page: number }> {
    const { data, total } = await this.mediaService.list({
      mimeType: query.mimeType,
      source: query.source,
      sourceId: query.sourceId,
      tags: query.tags,
      category: query.category,
      page: query.page,
      limit: query.limit,
    });

    return {
      data: data.map((item) => MediaFileResponseDto.fromEntity(item)),
      total,
      page: query.page || 1,
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Hybrid search media (fulltext + vector)' })
  async search(
    @Query() query: MediaSearchQueryDto,
  ): Promise<{ results: MediaFileResponseDto[]; total: number; page: number }> {
    const results = await this.mediaService.search(query.q, {
      mimeType: query.type,
      category: query.category,
    });

    const startIndex = ((query.page || 1) - 1) * (query.limit || 20);
    const endIndex = startIndex + (query.limit || 20);
    const paginatedResults = results.slice(startIndex, endIndex);

    return {
      results: paginatedResults.map((item) => MediaFileResponseDto.fromEntity(item)),
      total: results.length,
      page: query.page || 1,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media file by ID' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MediaFileResponseDto> {
    const mediaFile = await this.mediaService.findById(id);
    if (!mediaFile) {
      throw new Error(`Media file with ID ${id} not found`);
    }
    return MediaFileResponseDto.fromEntity(mediaFile);
  }
}
