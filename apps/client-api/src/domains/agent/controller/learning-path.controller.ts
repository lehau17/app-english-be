import { Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { GetUser } from '../../../../../common/decorator/get-user.decorator';
import { LearningPath, User } from '@prisma/client';
import { LearningPathService } from '../service/learning-path.service';
import { PrismaRepository } from '@app/database';

@ApiTags('AI Agent (Learning Path)')
@Controller('/api/v1/learning-path')
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
export class LearningPathController {
  private readonly logger = new Logger(LearningPathController.name);

  constructor(
    private readonly learningPathService: LearningPathService,
    private readonly prisma: PrismaRepository,
  ) {}

  @Get('my-path')
  @ApiOperation({
    summary: 'Get my current learning path',
    description: 'Lấy lộ trình học tập hiện tại của người dùng đang đăng nhập.',
  })
  async getMyLearningPath(@GetUser() user: User): Promise<LearningPath | null> {
    this.logger.log(`Fetching learning path for user: ${user.id}`);
    return this.prisma.learningPath.findUnique({
      where: { userId: user.id },
    });
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generate a new dynamic learning path',
    description: 'Kích hoạt việc tạo một lộ trình học tập mới dựa trên phân tích hiệu suất của người dùng.',
  })
  async generateNewPath(@GetUser() user: User): Promise<LearningPath | null> {
    this.logger.log(`Triggering learning path generation for user: ${user.id}`);
    return this.learningPathService.generateDynamicLearningPath(user.id);
  }
}