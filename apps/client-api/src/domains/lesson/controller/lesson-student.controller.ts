import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LessonService } from '../service/lesson.service';

@ApiTags('Lessons')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/lessons')
export class LessonStudentController {
  constructor(private readonly lessonService: LessonService) {}

  @Get('next')
  @ApiOperation({
    summary:
      'Get next lesson for current user (smart recommendation with learning path)',
  })
  async getNextLesson(@Req() req) {
    const userId = req.user.id;
    // Use smart next lesson logic with learning path support
    const result = await this.lessonService.findNextLessonForUserSmart(userId);
    return result;
  }

  @Post(':lessonId/unlock-next')
  @ApiOperation({
    summary: 'Unlock next lesson after completing current lesson',
  })
  async unlockNextLesson(@Param('lessonId') lessonId: string, @Req() req) {
    const userId = req.user.id;
    return this.lessonService.unlockNextLesson(lessonId, userId);
  }
}
