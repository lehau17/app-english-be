import { Controller, Get, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LessonService } from '../service/lesson.service';

@ApiTags('Lessons')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/lessons')
export class LessonStudentController {
  constructor(private readonly lessonService: LessonService) {}

  @Get('next')
  @ApiOperation({ summary: 'Get next lesson for current user' })
  async getNextLesson(@Req() req) {
    const userId = req.user.id;
    // Logic: lấy tất cả lesson, tìm lesson đầu tiên chưa hoàn thành
    // (giả sử có hàm lessonService.findNextLessonForUser)
    return this.lessonService.findNextLessonForUser(userId);
  }
}
