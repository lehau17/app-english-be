import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CourseService } from '../service/course.service';

@ApiTags('Public Courses')
@Controller('/public/v1/courses')
export class PublicCourseController {
  constructor(private readonly courseService: CourseService) {}

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
