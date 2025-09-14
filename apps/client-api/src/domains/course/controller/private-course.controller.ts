import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
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
  UploadedFiles,
  UseInterceptors
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Course } from '@prisma/client';
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
  constructor(private readonly courseService: CourseService,
    private readonly svc: CoursesImportService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a course' })
  @ResponseMessage('Course created successfully')
  create(@Body() dto: CreateCourseDto) {
    return this.courseService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course by id' })
  @ResponseMessage('Course fetched successfully')
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.courseService.findById(id);
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
  importExcel(@Body() dto: ImportCoursesDto) {
    return this.svc.importFromExcel(dto);
  }

  @Post('import-multiple-excels')
  @ApiOperation({ summary: 'Import nhiều file Excel cùng lúc' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files'))
  importMultipleExcels(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: Omit<ImportCoursesDto, 'url'>,
    @PayloadToken() payload : JwtPayload
  ) {
    if (!files || files.length === 0) {
      throw new Error('Không có file nào được upload');
    }

    if (files.length > 10) {
      throw new Error('Tối đa 10 file cùng lúc');
    }

    // Lấy instructorId từ JWT token nếu không có trong DTO
    const defaultInstructorId = dto.defaultInstructorId || payload.sub
    const finalDto = { ...dto, defaultInstructorId };

    return this.svc.importMultipleExcels(files, finalDto);
  }
}
