import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VocabularyUnitResponseDto } from '../dto/vocabulary-unit.dto';
import { VocabularyUnitService } from '../service/vocabulary-unit.service';

@ApiTags('Vocabulary Units')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/vocabulary/lists/:listId/units')
export class VocabularyUnitController {
  constructor(private readonly unitService: VocabularyUnitService) {}

  @Get()
  @ApiOperation({ summary: 'Get all units in a list' })
  @ApiParam({ name: 'listId', description: 'List ID' })
  @ApiResponse({ status: 200, type: [VocabularyUnitResponseDto] })
  @ResponseMessage('Units retrieved successfully')
  async getUnits(
    @Param('listId') listId: string,
    @PayloadToken() user: JwtPayload,
  ): Promise<VocabularyUnitResponseDto[]> {
    return this.unitService.getUnits(listId, user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get unit by ID with terms' })
  @ApiParam({ name: 'listId', description: 'List ID' })
  @ApiParam({ name: 'id', description: 'Unit ID' })
  @ApiResponse({ status: 200, type: VocabularyUnitResponseDto })
  @ResponseMessage('Unit retrieved successfully')
  async getUnit(
    @Param('id') id: string,
    @PayloadToken() user: JwtPayload,
  ): Promise<VocabularyUnitResponseDto> {
    return this.unitService.getUnit(id, user.sub);
  }
}
