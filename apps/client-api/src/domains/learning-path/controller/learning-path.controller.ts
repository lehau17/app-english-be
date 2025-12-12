import { JwtPayload, PayloadToken } from '@app/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateLearningPathDto,
  GenerateLearningPathForExistingStudentDto,
  GenerateLearningPathForNewStudentDto,
  LearningPathResponseDto,
  UpdateLearningPathDto,
} from '../dto';
import { LearningPathGenerationService } from '../service/learning-path-generation.service';
import { LearningPathService } from '../service/learning-path.service';

@ApiTags('Learning Paths')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/learning-paths')
export class LearningPathController {
  constructor(
    private readonly service: LearningPathService,
    private readonly generationService: LearningPathGenerationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new learning path' })
  @ApiResponse({ status: 201, type: LearningPathResponseDto })
  async create(
    @PayloadToken() payload: JwtPayload,
    @Body() dto: CreateLearningPathDto,
  ) {
    return this.service.create(payload.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get learning paths for current user' })
  @ApiQuery({ name: 'isCompleted', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [LearningPathResponseDto] })
  async findByUserId(
    @PayloadToken() payload: JwtPayload,
    @Query('isCompleted') isCompleted?: string,
  ) {
    const filters =
      isCompleted !== undefined
        ? { isCompleted: isCompleted === 'true' }
        : undefined;
    return this.service.findByUserId(payload.sub, filters);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active learning path for current user' })
  @ApiResponse({ status: 200, type: LearningPathResponseDto })
  async findActive(@PayloadToken() payload: JwtPayload) {
    return this.service.findActiveByUserId(payload.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get learning path by ID' })
  @ApiResponse({ status: 200, type: LearningPathResponseDto })
  async findById(@Param('id') id: string, @PayloadToken() payload: JwtPayload) {
    return this.service.findById(id, payload.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update learning path' })
  @ApiResponse({ status: 200, type: LearningPathResponseDto })
  async update(
    @Param('id') id: string,
    @PayloadToken() payload: JwtPayload,
    @Body() dto: UpdateLearningPathDto,
  ) {
    return this.service.update(id, payload.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete learning path' })
  async delete(@Param('id') id: string, @PayloadToken() payload: JwtPayload) {
    await this.service.delete(id, payload.sub);
  }

  @Post(':id/advance')
  @ApiOperation({ summary: 'Advance to next step in learning path' })
  @ApiResponse({ status: 200, type: LearningPathResponseDto })
  async advanceStep(
    @Param('id') id: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.service.advanceStep(id, payload.sub);
  }

  @Get(':id/progress')
  @ApiOperation({ summary: 'Get learning path progress' })
  async getProgress(
    @Param('id') id: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.service.getProgress(id, payload.sub);
  }

  @Post('generate/new-student')
  @ApiOperation({ summary: 'Auto-generate learning path for new student' })
  @ApiResponse({
    status: 201,
    description: 'Learning path ID',
    schema: { type: 'object', properties: { pathId: { type: 'string' } } },
  })
  async generateForNewStudent(
    @PayloadToken() payload: JwtPayload,
    @Body() dto: GenerateLearningPathForNewStudentDto,
  ) {
    const pathId = await this.generationService.generateForNewStudent(
      payload.sub,
      dto,
    );
    return { pathId };
  }

  @Post('generate/existing-student')
  @ApiOperation({
    summary: 'Auto-generate or update learning path for existing student',
  })
  @ApiResponse({
    status: 201,
    description: 'Learning path ID',
    schema: { type: 'object', properties: { pathId: { type: 'string' } } },
  })
  async generateForExistingStudent(
    @PayloadToken() payload: JwtPayload,
    @Body() dto: GenerateLearningPathForExistingStudentDto,
  ) {
    const pathId = await this.generationService.generateForExistingStudent(
      payload.sub,
      dto.updateReason,
    );
    return { pathId };
  }
}
