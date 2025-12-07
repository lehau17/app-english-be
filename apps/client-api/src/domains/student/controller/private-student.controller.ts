// src/modules/student/controller/student.controller.ts
import { ResponseMessage } from '@app/shared'; // decorator message bạn đã tạo
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
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
import { User } from '@prisma/client';
import { Response } from 'express';
import {
    CreateStudentDto,
    FilterStudentRequestDto,
    UpdateStudentDto,
} from '../dto/student.dto';
import { StudentService } from '../service/student.service';

@ApiTags('Students')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/students')
export class StudentController {
    constructor(private readonly studentService: StudentService) { }

    @Post()
    @ApiOperation({ summary: 'Create a student' })
    @ResponseMessage('Student created successfully')
    create(@Body() dto: CreateStudentDto) {
        return this.studentService.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'List students (paginated)' })
    @ResponseMessage('Students listed successfully')
    list(
        @Query() query: FilterStudentRequestDto,
    ): Promise<PageResponseDto<User>> {
        return this.studentService.list(query);
    }

    // Static routes MUST come before parameterized routes (:id) to avoid route conflicts
    @Get('stats')
    @ApiOperation({ summary: 'Get student statistics' })
    @ResponseMessage('Student statistics fetched successfully')
    getStats() {
        return this.studentService.getStats();
    }

    @Get('export')
    @ApiOperation({ summary: 'Export students to Excel file' })
    @ResponseMessage('Students exported successfully')
    async exportStudents(
        @Query() query: FilterStudentRequestDto,
        @Res() res: Response,
    ) {
        const buffer = await this.studentService.exportStudents(query);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=students-${new Date().toISOString().split('T')[0]}.xlsx`,
        );
        res.send(buffer);
    }

    @Get('import-template')
    @ApiOperation({ summary: 'Download CSV template for importing students' })
    @ResponseMessage('Template downloaded successfully')
    async downloadImportTemplate(@Res() res: Response) {
        const csv = this.studentService.getImportTemplate();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=students-import-template.csv`,
        );
        res.send(csv);
    }

    @Post('import')
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Import students from a CSV file' })
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
    @ResponseMessage('Students imported successfully')
    importStudents(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        return this.studentService.importStudents(file.buffer);
    }

    @Post('bulk-delete')
    @ApiOperation({ summary: 'Bulk delete students' })
    @ResponseMessage('Students deleted successfully')
    bulkDelete(@Body() body: { ids: string[] }) {
        return this.studentService.bulkDelete(body.ids);
    }

    // Parameterized routes MUST come after static routes
    @Get(':id')
    @ApiOperation({ summary: 'Get student by id' })
    @ResponseMessage('Student fetched successfully')
    findById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.studentService.findById(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update student by id' })
    @ResponseMessage('Student updated successfully')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateStudentDto,
    ) {
        return this.studentService.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Soft delete student by id' })
    @ResponseMessage('Student deleted successfully')
    delete(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.studentService.delete(id);
    }

    @Post(':id/avatar')
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Upload student avatar' })
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
    @ResponseMessage('Avatar uploaded successfully')
    async uploadAvatar(
        @Param('id', new ParseUUIDPipe()) id: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        return this.studentService.uploadAvatar(id, file);
    }

    // Parameterized routes must come after static routes
    @Post(':id/reset-password')
    @ApiOperation({ summary: 'Reset student password' })
    @ResponseMessage('Password reset successfully')
    resetPassword(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() body: { newPassword: string },
    ) {
        return this.studentService.resetPassword(id, body.newPassword);
    }

    @Patch(':id/activate')
    @ApiOperation({ summary: 'Activate student' })
    @ResponseMessage('Student activated successfully')
    activate(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.studentService.activate(id);
    }

    @Patch(':id/deactivate')
    @ApiOperation({ summary: 'Deactivate student' })
    @ResponseMessage('Student deactivated successfully')
    deactivate(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.studentService.deactivate(id);
    }
}
