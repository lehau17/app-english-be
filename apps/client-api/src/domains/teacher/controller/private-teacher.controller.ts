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
import { User } from '@prisma/client';
import { CreateTeacherDto, FilterTeacherRequestDto, UpdateTeacherDto } from '../dto/teacher.dto';
import { TeacherService } from '../service/teacher.service';

@ApiTags('Teachers')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/teachers')
export class PrivateTeacherController {
    constructor(private readonly teacherService: TeacherService) { }

    @Post()
    @ApiOperation({ summary: 'Create a teacher' })
    @ResponseMessage('Teacher created successfully')
    create(@Body() dto: CreateTeacherDto) {
        return this.teacherService.create(dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get teacher by id' })
    @ResponseMessage('Teacher fetched successfully')
    findById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.teacherService.findById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update teacher by id' })
    @ResponseMessage('Teacher updated successfully')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateTeacherDto,
    ) {
        return this.teacherService.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete teacher by id' })
    @ResponseMessage('Teacher deleted successfully')
    delete(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.teacherService.delete(id);
    }

    @Get()
    @ApiOperation({ summary: 'List teachers (paginated)' })
    @ResponseMessage('Teachers listed successfully')
    list(@Query() query: FilterTeacherRequestDto): Promise<PageResponseDto<User>> {
        return this.teacherService.list(query);
    }
}
