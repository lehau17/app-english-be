import { ResponseMessage } from '@app/shared';
import {
    BadRequestException,
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
    Res,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import {
    AssignParentDto,
    CreateParentDto,
    ParentListQueryDto,
    UpdateParentDto,
} from '../dto';
import { AdminParentService } from '../service';

@ApiTags('Admin - Parents')
@ApiBearerAuth()
@Controller('/private/v1/admin/parents')
export class AdminParentController {
    constructor(private readonly adminParentService: AdminParentService) { }

    @Get()
    @ApiOperation({ summary: 'Get parents list with pagination and search' })
    @ResponseMessage('Parents list fetched successfully')
    getParents(@Query() query: ParentListQueryDto) {
        return this.adminParentService.getParents(query);
    }

    @Get('available-students')
    @ApiOperation({ summary: 'Get students available for parent assignment' })
    @ResponseMessage('Available students fetched successfully')
    getAvailableStudents(@Query('search') search?: string) {
        return this.adminParentService.getAvailableStudents(search);
    }



    @Post()
    @ApiOperation({ summary: 'Create new parent account' })
    @ResponseMessage('Parent created successfully')
    createParent(@Body() dto: CreateParentDto) {
        return this.adminParentService.createParent(dto);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update parent information' })
    @ResponseMessage('Parent updated successfully')
    updateParent(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateParentDto,
    ) {
        return this.adminParentService.updateParent(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete parent account' })
    @ResponseMessage('Parent deleted successfully')
    deleteParent(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.adminParentService.deleteParent(id);
    }

    @Post(':parentId/assign-children')
    @ApiOperation({ summary: 'Assign children to parent' })
    @ResponseMessage('Children assigned to parent successfully')
    assignChildren(
        @Param('parentId', new ParseUUIDPipe()) parentId: string,
        @Body() dto: AssignParentDto,
    ) {
        return this.adminParentService.assignChildren(parentId, dto);
    }

    @Get(':parentId/children')
    @ApiOperation({ summary: 'Get children assigned to a parent' })
    @ResponseMessage('Parent children fetched successfully')
    getParentChildren(@Param('parentId', new ParseUUIDPipe()) parentId: string) {
        return this.adminParentService.getParentChildren(parentId);
    }

    @Delete(':parentId/children/:childId')
    @ApiOperation({ summary: 'Remove child from parent' })
    @ResponseMessage('Child removed from parent successfully')
    removeChildFromParent(
        @Param('parentId', new ParseUUIDPipe()) parentId: string,
        @Param('childId', new ParseUUIDPipe()) childId: string,
    ) {
        return this.adminParentService.removeChildFromParent(parentId, childId);
    }

    @Patch(':id/toggle-status')
    @ApiOperation({ summary: 'Toggle parent account active status' })
    @ResponseMessage('Parent status toggled successfully')
    toggleParentStatus(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.adminParentService.toggleParentStatus(id);
    }

    // Static routes MUST come before parameterized routes (:id) to avoid route conflicts
    @Get('stats')
    @ApiOperation({ summary: 'Get parent statistics' })
    @ResponseMessage('Parent statistics fetched successfully')
    getStats() {
        return this.adminParentService.getStats();
    }

    @Post('bulk-delete')
    @ApiOperation({ summary: 'Bulk delete parents' })
    @ResponseMessage('Parents deleted successfully')
    bulkDelete(@Body() body: { ids: string[] }) {
        return this.adminParentService.bulkDelete(body.ids);
    }

    @Post('bulk-activate')
    @ApiOperation({ summary: 'Bulk activate parents' })
    @ResponseMessage('Parents activated successfully')
    bulkActivate(@Body() body: { ids: string[] }) {
        return this.adminParentService.bulkActivate(body.ids);
    }

    @Post('bulk-deactivate')
    @ApiOperation({ summary: 'Bulk deactivate parents' })
    @ResponseMessage('Parents deactivated successfully')
    bulkDeactivate(@Body() body: { ids: string[] }) {
        return this.adminParentService.bulkDeactivate(body.ids);
    }

    @Get('export')
    @ApiOperation({ summary: 'Export parents to Excel file' })
    @ResponseMessage('Parents exported successfully')
    async exportParents(
        @Query() query: ParentListQueryDto,
        @Res() res: Response,
    ) {
        const buffer = await this.adminParentService.exportParents(query);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=parents-${new Date().toISOString().split('T')[0]}.xlsx`,
        );
        res.send(buffer);
    }

    @Get('import-template')
    @ApiOperation({ summary: 'Download CSV template for importing parents' })
    @ResponseMessage('Template downloaded successfully')
    async downloadImportTemplate(@Res() res: Response) {
        const csv = this.adminParentService.getImportTemplate();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=parents-import-template.csv`,
        );
        res.send(csv);
    }

    @Post('import')
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Import parents from a CSV file' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @ResponseMessage('Parents imported successfully')
    importParents(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        return this.adminParentService.importParents(file.buffer);
    }


    @Get(':id')
    @ApiOperation({ summary: 'Get parent details by ID' })
    @ResponseMessage('Parent details fetched successfully')
    getParentById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.adminParentService.getParentById(id);
    }
}
