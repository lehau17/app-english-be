import { ResponseMessage, Roles, RolesGuard } from '@app/shared';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CreateCertificateTemplateDto, UpdateCertificateTemplateDto } from '../dto';
import { CertificateTemplateService } from '../services';

@ApiTags('Certificate Templates')
@Controller('private/v1/certificate-templates')
@ApiBearerAuth('Authorization')
export class CertificateTemplateController {
    constructor(private readonly templateService: CertificateTemplateService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.admin, UserRole.teacher, UserRole.content_creator)
    @ApiOperation({ summary: 'Create certificate template' })
    @ApiResponse({ status: 201, description: 'Template created successfully' })
    @ResponseMessage('Certificate template created successfully')
    async create(@Body() dto: CreateCertificateTemplateDto) {
        return this.templateService.create(dto);
    }

    @Post('courses/:courseId/default')
    @UseGuards(RolesGuard)
    @Roles(UserRole.admin, UserRole.teacher, UserRole.content_creator)
    @ApiOperation({ summary: 'Create default certificate template for course' })
    @ApiResponse({ status: 201, description: 'Default template created' })
    @ResponseMessage('Default certificate template created successfully')
    async createDefault(@Param('courseId') courseId: string) {
        return this.templateService.createDefaultTemplate(courseId);
    }

    @Get(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.admin, UserRole.teacher, UserRole.content_creator)
    @ApiOperation({ summary: 'Get certificate template by ID' })
    @ApiResponse({ status: 200, description: 'Template found' })
    @ResponseMessage('Certificate template retrieved successfully')
    async getById(@Param('id') id: string) {
        return this.templateService.getTemplateById(id);
    }

    @Get('courses/:courseId')
    @ApiOperation({ summary: 'Get certificate template by course ID' })
    @ApiResponse({ status: 200, description: 'Template found' })
    @ResponseMessage('Certificate template retrieved successfully')
    async getByCourseId(@Param('courseId') courseId: string) {
        // All authenticated users can view course certificate templates
        return this.templateService.getTemplateByCourseId(courseId);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.admin, UserRole.teacher, UserRole.content_creator)
    @ApiOperation({ summary: 'Update certificate template' })
    @ApiResponse({ status: 200, description: 'Template updated' })
    @ResponseMessage('Certificate template updated successfully')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateCertificateTemplateDto,
    ) {
        return this.templateService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.admin)
    @ApiOperation({ summary: 'Delete certificate template' })
    @ApiResponse({ status: 200, description: 'Template deleted' })
    @ResponseMessage('Certificate template deleted successfully')
    async delete(@Param('id') id: string) {
        await this.templateService.delete(id);
        return { message: 'Certificate template deleted successfully' };
    }

    @Get()
    @UseGuards(RolesGuard)
    @Roles(UserRole.admin, UserRole.teacher, UserRole.content_creator)
    @ApiOperation({ summary: 'Get all certificate templates' })
    @ApiResponse({ status: 200, description: 'Templates retrieved' })
    @ResponseMessage('Certificate templates retrieved successfully')
    async findAll(
        @Query('skip') skip?: number,
        @Query('take') take?: number,
        @Query('isActive') isActive?: boolean,
    ) {
        return this.templateService.findAll({
            skip: skip ? +skip : undefined,
            take: take ? +take : undefined,
            isActive: isActive !== undefined ? isActive === true : undefined,
        });
    }
}
