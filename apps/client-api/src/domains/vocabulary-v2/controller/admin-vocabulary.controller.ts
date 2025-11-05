import { JwtPayload, PayloadToken, ResponseMessage, Roles } from '@app/shared';
import {
    Body,
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
    CreateVocabularyListDto,
    UpdateVocabularyListDto,
    VocabularyListResponseDto,
} from '../dto/vocabulary-list.dto';
import {
    CreateVocabularyTermDto,
    ImportTermsDto,
    ReorderTermsDto,
    UpdateVocabularyTermDto,
    VocabularyTermResponseDto,
} from '../dto/vocabulary-term.dto';
import {
    CreateVocabularyUnitDto,
    ReorderUnitsDto,
    UpdateVocabularyUnitDto,
    VocabularyUnitResponseDto,
} from '../dto/vocabulary-unit.dto';
import { VocabularyListService } from '../service/vocabulary-list.service';
import { VocabularyTermService } from '../service/vocabulary-term.service';
import { VocabularyUnitService } from '../service/vocabulary-unit.service';

@ApiTags('Admin - Vocabulary')
@ApiBearerAuth('Authorization')
@Roles('admin', 'teacher')
@Controller('/private/v1/admin/vocabulary')
export class AdminVocabularyController {
    constructor(
        private readonly listService: VocabularyListService,
        private readonly unitService: VocabularyUnitService,
        private readonly termService: VocabularyTermService,
    ) { }

    // ==================== LISTS ====================

    @Post('lists')
    @ApiOperation({ summary: 'Create vocabulary list' })
    @ApiResponse({ status: 201, type: VocabularyListResponseDto })
    @ResponseMessage('List created successfully')
    async createList(
        @Body() dto: CreateVocabularyListDto,
        @PayloadToken() user: JwtPayload,
    ): Promise<VocabularyListResponseDto> {
        return this.listService.createList(dto, user.sub);
    }

    @Put('lists/:id')
    @ApiOperation({ summary: 'Update vocabulary list' })
    @ApiParam({ name: 'id', description: 'List ID' })
    @ApiResponse({ status: 200, type: VocabularyListResponseDto })
    @ResponseMessage('List updated successfully')
    async updateList(
        @Param('id') id: string,
        @Body() dto: UpdateVocabularyListDto,
        @PayloadToken() user: JwtPayload,
    ): Promise<VocabularyListResponseDto> {
        return this.listService.updateList(id, dto, user.sub);
    }

    @Delete('lists/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete vocabulary list' })
    @ApiParam({ name: 'id', description: 'List ID' })
    @ResponseMessage('List deleted successfully')
    async deleteList(
        @Param('id') id: string,
        @PayloadToken() user: JwtPayload,
    ): Promise<void> {
        await this.listService.deleteList(id, user.sub);
    }

    // ==================== UNITS ====================

    @Post('lists/:listId/units')
    @ApiOperation({ summary: 'Create unit in list' })
    @ApiParam({ name: 'listId', description: 'List ID' })
    @ApiResponse({ status: 201, type: VocabularyUnitResponseDto })
    @ResponseMessage('Unit created successfully')
    async createUnit(
        @Param('listId') listId: string,
        @Body() dto: CreateVocabularyUnitDto,
    ): Promise<VocabularyUnitResponseDto> {
        return this.unitService.createUnit(listId, dto);
    }

    @Put('units/:id')
    @ApiOperation({ summary: 'Update unit' })
    @ApiParam({ name: 'id', description: 'Unit ID' })
    @ApiResponse({ status: 200, type: VocabularyUnitResponseDto })
    @ResponseMessage('Unit updated successfully')
    async updateUnit(
        @Param('id') id: string,
        @Body() dto: UpdateVocabularyUnitDto,
    ): Promise<VocabularyUnitResponseDto> {
        return this.unitService.updateUnit(id, dto);
    }

    @Delete('units/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete unit' })
    @ApiParam({ name: 'id', description: 'Unit ID' })
    @ResponseMessage('Unit deleted successfully')
    async deleteUnit(@Param('id') id: string): Promise<void> {
        await this.unitService.deleteUnit(id);
    }

    @Post('lists/:listId/units/reorder')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reorder units in list' })
    @ApiParam({ name: 'listId', description: 'List ID' })
    @ResponseMessage('Units reordered successfully')
    async reorderUnits(
        @Param('listId') listId: string,
        @Body() dto: ReorderUnitsDto,
    ): Promise<{ message: string }> {
        await this.unitService.reorderUnits(listId, dto.unitIds);
        return { message: 'Units reordered successfully' };
    }

    // ==================== TERMS ====================

    @Post('units/:unitId/terms')
    @ApiOperation({ summary: 'Create term in unit' })
    @ApiParam({ name: 'unitId', description: 'Unit ID' })
    @ApiResponse({ status: 201, type: VocabularyTermResponseDto })
    @ResponseMessage('Term created successfully')
    async createTerm(
        @Param('unitId') unitId: string,
        @Body() dto: CreateVocabularyTermDto,
    ): Promise<VocabularyTermResponseDto> {
        return this.termService.createTerm(unitId, dto);
    }

    @Post('units/:unitId/terms/import')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Import multiple terms into unit' })
    @ApiParam({ name: 'unitId', description: 'Unit ID' })
    @ResponseMessage('Terms imported successfully')
    async importTerms(
        @Param('unitId') unitId: string,
        @Body() dto: ImportTermsDto,
    ): Promise<{ message: string; count: number }> {
        await this.termService.importTerms(unitId, dto.terms);
        return { message: 'Terms imported successfully', count: dto.terms.length };
    }

    @Put('terms/:id')
    @ApiOperation({ summary: 'Update term' })
    @ApiParam({ name: 'id', description: 'Term ID' })
    @ApiResponse({ status: 200, type: VocabularyTermResponseDto })
    @ResponseMessage('Term updated successfully')
    async updateTerm(
        @Param('id') id: string,
        @Body() dto: UpdateVocabularyTermDto,
    ): Promise<VocabularyTermResponseDto> {
        return this.termService.updateTerm(id, dto);
    }

    @Delete('terms/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete term' })
    @ApiParam({ name: 'id', description: 'Term ID' })
    @ResponseMessage('Term deleted successfully')
    async deleteTerm(@Param('id') id: string): Promise<void> {
        await this.termService.deleteTerm(id);
    }

    @Post('units/:unitId/terms/reorder')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reorder terms in unit' })
    @ApiParam({ name: 'unitId', description: 'Unit ID' })
    @ResponseMessage('Terms reordered successfully')
    async reorderTerms(
        @Param('unitId') unitId: string,
        @Body() dto: ReorderTermsDto,
    ): Promise<{ message: string }> {
        await this.termService.reorderTerms(unitId, dto.termIds);
        return { message: 'Terms reordered successfully' };
    }
}



