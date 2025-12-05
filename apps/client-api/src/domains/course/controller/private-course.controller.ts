import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Course } from '@prisma/client';
import { Response } from 'express';
import {
  CreateCourseDto,
  FilterCourseRequestDto,
  ImportCoursesDto,
  UpdateCourseDto,
} from '../dto/course.dto';
import { CourseService } from '../service/course.service';
import { CoursesImportService } from '../service/couse-import.service';

@ApiTags('Courses')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/courses')
export class CourseController {
    constructor(
        private readonly courseService: CourseService,
        private readonly svc: CoursesImportService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a course' })
    @ResponseMessage('Course created successfully')
    create(@Body() dto: CreateCourseDto, @PayloadToken() payload: JwtPayload) {
        return this.courseService.create(dto, payload.sub);
    }



    @Put(':id')
    @ApiOperation({ summary: 'Update course by id' })
    @ResponseMessage('Course updated successfully')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateCourseDto,
    ) {
        return this.courseService.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete course by id' })
    @ResponseMessage('Course deleted successfully')
    delete(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.courseService.delete(id);
    }

    @Get()
    @ApiOperation({ summary: 'List courses (paginated + filters)' })
    @ResponseMessage('Courses listed successfully')
    list(
        @Query() query: FilterCourseRequestDto,
    ): Promise<PageResponseDto<Course>> {
        return this.courseService.list(query);
    }

    // Static routes MUST come before parameterized routes (:id) to avoid route conflicts
    @Get('stats')
    @ApiOperation({ summary: 'Get course statistics' })
    @ResponseMessage('Course statistics fetched successfully')
    getStats() {
        return this.courseService.getStats();
    }

    @Post('bulk-delete')
    @ApiOperation({ summary: 'Bulk delete courses' })
    @ResponseMessage('Courses deleted successfully')
    bulkDelete(@Body() body: { ids: string[] }) {
        return this.courseService.bulkDelete(body.ids);
    }

    @Post('bulk-publish')
    @ApiOperation({ summary: 'Bulk publish courses' })
    @ResponseMessage('Courses published successfully')
    bulkPublish(@Body() body: { ids: string[] }) {
        return this.courseService.bulkPublish(body.ids);
    }

    @Post('bulk-unpublish')
    @ApiOperation({ summary: 'Bulk unpublish courses' })
    @ResponseMessage('Courses unpublished successfully')
    bulkUnpublish(@Body() body: { ids: string[] }) {
        return this.courseService.bulkUnpublish(body.ids);
    }

    @Get('export')
    @ApiOperation({ summary: 'Export courses to CSV file' })
    @ResponseMessage('Courses exported successfully')
    async exportCourses(
        @Query() query: FilterCourseRequestDto,
        @Res() res: Response,
    ) {
        const csv = await this.courseService.exportCourses(query);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=courses-${new Date().toISOString()}.csv`,
        );
        res.send(csv);
    }

    @Patch(':id/publish')
    @ApiOperation({ summary: 'Publish a course' })
    @ResponseMessage('Course published successfully')
    publish(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.courseService.publish(id);
    }

    @Patch(':id/unpublish')
    @ApiOperation({ summary: 'Unpublish a course' })
    @ResponseMessage('Course unpublished successfully')
    unpublish(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.courseService.unpublish(id);
    }

    @Post('import-excel')
    importExcel(
        @Body() dto: ImportCoursesDto,
        @PayloadToken() payload: JwtPayload,
    ) {
        return this.svc.importFromExcel(dto, payload.sub);
    }

    @Post('import-multiple-excels')
    @ApiOperation({ summary: 'Import nhiều file Excel cùng lúc' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FilesInterceptor('files'))
    importMultipleExcels(
        @UploadedFiles() files: Express.Multer.File[],
        @Body() dto: Omit<ImportCoursesDto, 'url'>,
        @PayloadToken() payload: JwtPayload,
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('Không có file nào được upload');
        }

        if (files.length > 10) {
            throw new BadRequestException('Tối đa 10 file cùng lúc');
        }

        // Lấy instructorId từ DTO hoặc JWT token
        const finalDto = {
            ...dto,
            defaultInstructorId: dto.defaultInstructorId || payload.sub,
        };

        return this.svc.importMultipleExcels(files, finalDto, payload.sub);
    }

    @Get('templates/download')
    @ApiOperation({ summary: 'Download template Excel for course import' })
    @Header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    async downloadTemplate(@Res() res: Response) {
        const template = await this.svc.downloadTemplate();

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${template.filename}"`,
        );
        res.setHeader('Content-Type', template.contentType);

        return res.send(template.buffer);
    }





    @Get(':id')
    @ApiOperation({ summary: 'Get course by id' })
    @ResponseMessage('Course fetched successfully')
    findById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.courseService.findById(id);
    }
}
