// src/modules/student/controller/student.controller.ts
import { ResponseMessage } from '@app/shared'; // decorator message bạn đã tạo
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
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
  constructor(private readonly studentService: StudentService) {}

  @Post()
  @ApiOperation({ summary: 'Create a student' })
  @ResponseMessage('Student created successfully')
  create(@Body() dto: CreateStudentDto) {
    return this.studentService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student by id' })
  @ResponseMessage('Student fetched successfully')
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.studentService.findById(id);
  }

  @Put(':id')
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

  @Get()
  @ApiOperation({ summary: 'List students (paginated)' })
  @ResponseMessage('Students listed successfully')
  list(
    @Query() query: FilterStudentRequestDto,
  ): Promise<PageResponseDto<User>> {
    return this.studentService.list(query);
  }
}
