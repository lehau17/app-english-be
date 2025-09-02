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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Lesson } from '@prisma/client';
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
    summary: 'Get lesson + activities (+questions count) + lessonDetails',
  })
  @ResponseMessage('Lesson full data fetched successfully')
  getFull(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.lessonService.getFull(id);
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
}
