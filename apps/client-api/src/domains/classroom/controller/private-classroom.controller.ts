import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
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
import { Classroom } from '@prisma/client';
import { Response } from 'express';
import {
  AddStudentToClassroomDto,
  AssignTeacherToClassroomDto,
  ClassroomAnnouncementQueryDto,
  CreateClassroomAnnouncementDto,
  CreateClassroomDto,
  FilterClassroomRequestDto,
  ImportStudentsResultDto,
  UpdateClassroomDto,
} from '../dto/classroom.dto';
import { ClassroomService } from '../service/classroom.service';

@ApiTags('Classrooms')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/classrooms')
export class PrivateClassroomController {
  constructor(private readonly classroomService: ClassroomService) {}

  @Get('my-classrooms')
  @ApiOperation({ summary: 'Get my classrooms' })
  @ResponseMessage('My classrooms fetched successfully')
  myClassrooms(@PayloadToken() payload: JwtPayload) {
    return this.classroomService.myClassrooms(payload);
  }

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
  list(
    @Query() query: FilterClassroomRequestDto,
  ): Promise<PageResponseDto<Classroom>> {
    return this.classroomService.list(query);
  }

  @Post(':id/students')
  @ApiOperation({ summary: 'Add a student to a classroom' })
  @ResponseMessage('Student added to classroom successfully')
  addStudentToClassroom(
    @Param('id', new ParseUUIDPipe()) classroomId: string,
    @Body() dto: AddStudentToClassroomDto,
  ) {
    return this.classroomService.addStudentToClassroom(classroomId, dto);
  }

  @Delete(':id/students/:studentId')
  @ApiOperation({ summary: 'Remove a student from a classroom' })
  @ResponseMessage('Student removed from classroom successfully')
  removeStudentFromClassroom(
    @Param('id', new ParseUUIDPipe()) classroomId: string,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
  ) {
    return this.classroomService.removeStudentFromClassroom(
      classroomId,
      studentId,
    );
  }

  @Put(':id/teacher')
  @ApiOperation({ summary: 'Assign a teacher to a classroom' })
  @ResponseMessage('Teacher assigned to classroom successfully')
  assignTeacherToClassroom(
    @Param('id', new ParseUUIDPipe()) classroomId: string,
    @Body() dto: AssignTeacherToClassroomDto,
  ) {
    return this.classroomService.assignTeacherToClassroom(classroomId, dto);
  }

  @Get(':id/detail')
  @ApiOperation({
    summary:
      'Get full classroom detail (students, assignments, announcements, lessons, activities)',
  })
  @ResponseMessage('Classroom detail fetched successfully')
  async getClassroomDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.classroomService.getClassroomDetail(id);
  }

  @Get(':id/announcements')
  @ApiOperation({ summary: 'List classroom announcements' })
  @ResponseMessage('Classroom announcements fetched successfully')
  async getClassroomAnnouncements(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ClassroomAnnouncementQueryDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.classroomService.getClassroomAnnouncements(id, payload, query);
  }

  @Post(':id/announcements')
  @ApiOperation({ summary: 'Create classroom announcement' })
  @ResponseMessage('Classroom announcement created successfully')
  async createClassroomAnnouncement(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CreateClassroomAnnouncementDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.classroomService.createClassroomAnnouncement(id, payload, body);
  }

  @Post(':id/import-students')
  @ApiOperation({ summary: 'Import students from Excel file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Excel file containing student data',
    type: 'multipart/form-data',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx, .xls)',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage('Students imported successfully')
  async importStudentsFromExcel(
    @Param('id', new ParseUUIDPipe()) classroomId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportStudentsResultDto> {
    return this.classroomService.importStudentsFromExcel(classroomId, file);
  }
}
