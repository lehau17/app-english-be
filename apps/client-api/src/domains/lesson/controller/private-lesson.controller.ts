import { PayloadToken, ResponseMessage } from '@app/shared';
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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Lesson } from '@prisma/client';
import { JwtPayload } from 'jsonwebtoken';
import {
  CanStartActivityRequestDto,
  CanStartActivityResponseDto,
  CompleteActivityRequestDto,
  CompleteActivityResponseDto,
  CreateLessonDto,
  FilterLessonRequestDto,
  GetLessonHubsRequestDto,
  GetLessonHubsResponseDto,
  LessonProgressSummaryDto,
  NextActivityResponseDto,
  NextLessonWithActivityResponseDto,
  StartActivityRequestDto,
  StartActivityResponseDto,
  UpdateLessonDto,
} from '../dto/lesson.dto';
import { LessonService } from '../service/lesson.service';

@ApiTags('Lessons')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/lessons')
export class PrivateLessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Get('next')
  @ApiOperation({ summary: 'Get next lesson with activity for current user' })
  @ApiResponse({
    status: 200,
    description: 'Next lesson with activity retrieved successfully',
    type: NextLessonWithActivityResponseDto,
  })
  async getNextLesson(
    @PayloadToken() payloadToken: JwtPayload,
  ): Promise<NextLessonWithActivityResponseDto> {
    const userId = payloadToken.sub;
    // Trả về lesson và activity tiếp theo chưa hoàn thành
    return this.lessonService.findNextLessonForUser(userId);
  }

  // ===== CRUD =====

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
  list(
    @Query() query: FilterLessonRequestDto,
  ): Promise<PageResponseDto<Lesson>> {
    return this.lessonService.list(query);
  }

  // ===== Learning Flow =====

  @Get(':id/full')
  @ApiOperation({
    summary:
      'Get lesson + activities (+questions count) + lessonDetails + progress if userId provided',
  })
  @ResponseMessage('Lesson full data fetched successfully')
  getFull(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('userId', new ParseUUIDPipe({ optional: true })) userId?: string,
  ) {
    return this.lessonService.getFull(id, userId);
  }

  @Get(':id/hubs')
  @ApiOperation({
    summary: 'Get Kids hubs (games/exercises/speaking) + media for a lesson',
  })
  @ResponseMessage('Lesson hubs fetched successfully')
  getHubs(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: GetLessonHubsRequestDto,
  ): Promise<GetLessonHubsResponseDto> {
    return this.lessonService.getHubs(id, query);
  }

  @Get(':id/next-activity')
  @ApiOperation({ summary: 'Get next activity for user (Continue)' })
  @ResponseMessage('Next activity fetched successfully')
  getNextActivity(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<NextActivityResponseDto> {
    return this.lessonService.getNextActivity(id, userId);
  }

  @Get(':id/progress-summary')
  @ApiOperation({ summary: 'Get lesson progress summary for user' })
  @ResponseMessage('Lesson progress summary fetched successfully')
  getProgressSummary(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<LessonProgressSummaryDto> {
    return this.lessonService.getProgressSummary(id, userId);
  }

  @Post('activity/can-start')
  @ApiOperation({ summary: 'Check if user can start an activity (gating)' })
  @ResponseMessage('Activity gating checked successfully')
  canStartActivity(
    @Body() dto: CanStartActivityRequestDto,
  ): Promise<CanStartActivityResponseDto> {
    return this.lessonService.canStartActivity(dto);
  }

  @Post('activity/start')
  @ApiOperation({
    summary: 'Start an activity (create/set Progress = in_progress)',
  })
  @ResponseMessage('Activity started successfully')
  startActivity(
    @Body() dto: StartActivityRequestDto,
  ): Promise<StartActivityResponseDto> {
    return this.lessonService.startActivity(dto);
  }

  @Post('activity/complete')
  @ApiOperation({
    summary: 'Complete an activity (update Progress based on score)',
  })
  @ResponseMessage('Activity completed successfully')
  completeActivity(
    @Body() dto: CompleteActivityRequestDto,
  ): Promise<CompleteActivityResponseDto> {
    return this.lessonService.completeActivity(dto);
  }

  @Post(':id/unlock')
  @ApiOperation({
    summary: 'Unlock next lesson when current lesson is completed',
  })
  @ResponseMessage('Next lesson unlocked successfully')
  async unlockNextLesson(
    @Param('id', new ParseUUIDPipe()) lessonId: string,
    @PayloadToken() payloadToken: JwtPayload,
  ): Promise<{ message: string; nextLessonId?: string }> {
    const userId = payloadToken.sub;
    return this.lessonService.unlockNextLesson(lessonId, userId);
  }
}
