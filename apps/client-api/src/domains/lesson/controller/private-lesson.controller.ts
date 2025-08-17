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
import { Lesson } from '@prisma/client';
import { CreateLessonDto, FilterLessonRequestDto, UpdateLessonDto } from '../dto/lesson.dto';
import { LessonService } from '../service/lesson.service';

@ApiTags('Lessons')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/lessons')
export class PrivateLessonController {
    constructor(private readonly lessonService: LessonService) { }

    @Post()
    @ApiOperation({ summary: 'Create a lesson' })
    @ResponseMessage('Lesson created successfully')
    create(@Body() dto: CreateLessonDto) {
        return this.lessonService.create(dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get lesson by id' })
    @ResponseMessage('Lesson fetched successfully')
    findById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.lessonService.findById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update lesson by id' })
    @ResponseMessage('Lesson updated successfully')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateLessonDto,
    ) {
        return this.lessonService.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete lesson by id' })
    @ResponseMessage('Lesson deleted successfully')
    delete(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.lessonService.delete(id);
    }

    @Get()
    @ApiOperation({ summary: 'List lessons (paginated)' })
    @ResponseMessage('Lessons listed successfully')
    list(@Query() query: FilterLessonRequestDto): Promise<PageResponseDto<Lesson>> {
        return this.lessonService.list(query);
    }
}