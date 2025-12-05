import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CourseService } from '../service/course.service';
import { CoursesImportService } from '../service/couse-import.service';

@ApiTags('Public Courses')
@Controller('/public/v1/courses')
export class PublicCourseController {
  constructor(private readonly courseService: CourseService,
    private readonly svc: CoursesImportService,

  ) { }


  @Get('templates/toeic-basic')
  @ApiOperation({
      summary: 'Download TOEIC Basic course template Excel',
      description:
          'Download a pre-filled Excel template for TOEIC Basic course with 10 lessons and 20 activities per lesson',
  })
  @Header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async downloadToeicBasicTemplate(@Res() res: Response) {
      const template = await this.svc.generateToeicBasicTemplate();

      res.setHeader(
          'Content-Disposition',
          `attachment; filename="${template.filename}"`,
      );
      res.setHeader('Content-Type', template.contentType);

      return res.send(template.buffer);
  }

  @Get('templates/toeic-intermediate')
  @ApiOperation({
      summary: 'Download TOEIC Intermediate course template Excel',
      description:
          'Download a pre-filled Excel template for TOEIC Intermediate course with 10 lessons and 20 activities per lesson',
  })
  @Header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async downloadToeicIntermediateTemplate(@Res() res: Response) {
      const template = await this.svc.generateToeicIntermediateTemplate();

      res.setHeader(
          'Content-Disposition',
          `attachment; filename="${template.filename}"`,
      );
      res.setHeader('Content-Type', template.contentType);

      return res.send(template.buffer);
  }

  @Get('templates/toeic-advanced')
  @ApiOperation({
      summary: 'Download TOEIC Advanced course template Excel',
      description:
          'Download a pre-filled Excel template for TOEIC Advanced course with 10 lessons and 20 activities per lesson',
  })
  @Header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async downloadToeicAdvancedTemplate(@Res() res: Response) {
      const template = await this.svc.generateToeicAdvancedTemplate();

      res.setHeader(
          'Content-Disposition',
          `attachment; filename="${template.filename}"`,
      );
      res.setHeader('Content-Type', template.contentType);

      return res.send(template.buffer);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách khóa học công khai' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách khóa học công khai',
  })
  async listCourses() {
    const data = await this.courseService.getPublicCourses();
    return {
      success: true,
      data,
    };
  }

  @Get(':courseId/classrooms')
  @ApiOperation({ summary: 'Danh sách lớp học công khai của khóa học' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách lớp học công khai',
  })
  async listClassrooms(@Param('courseId') courseId: string) {
    const data = await this.courseService.getPublicClassrooms(courseId);
    return {
      success: true,
      data,
    };
  }
}
