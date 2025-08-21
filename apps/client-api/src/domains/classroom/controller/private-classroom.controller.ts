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
    Query,
    Res
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Classroom } from '@prisma/client';
import { CreateClassroomDto, FilterClassroomRequestDto, UpdateClassroomDto, AddStudentToClassroomDto, AssignTeacherToClassroomDto } from '../dto/classroom.dto';
import { ClassroomService } from '../service/classroom.service';
import { Response } from 'express';

@ApiTags('Classrooms')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/classrooms')
export class PrivateClassroomController {
    constructor(private readonly classroomService: ClassroomService) { }

    @Post()
    @ApiOperation({ summary: 'Create a classroom' })
    @ResponseMessage('Classroom created successfully')
    create(@Body() dto: CreateClassroomDto) {
        return this.classroomService.create(dto);
    }

    @Get('export')
    @ApiOperation({ summary: 'Export classrooms to CSV' })
    exportToCsv(@Query() query: FilterClassroomRequestDto, @Res() res: Response) {
        res.header('Content-Type', 'text/csv');
        res.attachment('classrooms.csv');
        const csvStream = this.classroomService.exportToCsv(query);
        csvStream.pipe(res);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get classroom by id' })
    @ResponseMessage('Classroom fetched successfully')
    findById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.classroomService.findById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update classroom by id' })
    @ResponseMessage('Classroom updated successfully')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateClassroomDto,
    ) {
        return this.classroomService.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete classroom by id' })
    @ResponseMessage('Classroom deleted successfully')
    delete(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.classroomService.delete(id);
    }

    @Get()
    @ApiOperation({ summary: 'List classrooms (paginated)' })
    @ResponseMessage('Classrooms listed successfully')
    list(@Query() query: FilterClassroomRequestDto): Promise<PageResponseDto<Classroom>> {
        return this.classroomService.list(query);
    }

    @Post(':id/students')
    @ApiOperation({ summary: 'Add a student to a classroom' })
    @ResponseMessage('Student added to classroom successfully')
    addStudentToClassroom(
        @Param('id', new ParseUUIDPipe()) classroomId: string,
        @Body() dto: AddStudentToClassroomDto
    ) {
        return this.classroomService.addStudentToClassroom(classroomId, dto);
    }

    @Delete(':id/students/:studentId')
    @ApiOperation({ summary: 'Remove a student from a classroom' })
    @ResponseMessage('Student removed from classroom successfully')
    removeStudentFromClassroom(
        @Param('id', new ParseUUIDPipe()) classroomId: string,
        @Param('studentId', new ParseUUIDPipe()) studentId: string
    ) {
        return this.classroomService.removeStudentFromClassroom(classroomId, studentId);
    }

    @Put(':id/teacher')
    @ApiOperation({ summary: 'Assign a teacher to a classroom' })
    @ResponseMessage('Teacher assigned to classroom successfully')
    assignTeacherToClassroom(
        @Param('id', new ParseUUIDPipe()) classroomId: string,
        @Body() dto: AssignTeacherToClassroomDto
    ) {
        return this.classroomService.assignTeacherToClassroom(classroomId, dto);
    }
}
