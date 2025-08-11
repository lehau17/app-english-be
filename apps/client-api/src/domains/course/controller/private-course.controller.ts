
import { ResponseMessage } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
    Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Course } from '@prisma/client';
import { CreateCourseDto, FilterCourseRequestDto, UpdateCourseDto } from '../dto/course.dto';
import { CourseService } from '../service/course.service';

@ApiTags('Courses')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/courses')
export class CourseController {
    constructor(private readonly courseService: CourseService) { }

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
    @ApiOperation({ summary: 'List courses (paginated)' })
    @ResponseMessage('Courses listed successfully')
    list(@Query() query: FilterCourseRequestDto): Promise<PageResponseDto<Course>> {
        return this.courseService.list(query);
    }
}
