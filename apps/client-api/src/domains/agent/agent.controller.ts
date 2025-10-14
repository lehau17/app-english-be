import { Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { AgentChatDto, AgentChatResponseDto, AgentRecommendationDto } from './dto/agent.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { GetUser } from '../../../../common/decorator/get-user.decorator';
import { User } from '@prisma/client';

@ApiTags('AI Agent (Coach & RAG)')
@Controller('/api/v1/agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Chat with AI Learning Coach (RAG enabled)',
    description: 'Gửi tin nhắn tới AI agent. Agent sẽ sử dụng RAG để trả lời các câu hỏi dựa trên knowledge base.',
  })
  async chat(
    @Body() chatDto: AgentChatDto,
    @GetUser() user: User,
  ): Promise<AgentChatResponseDto> {
    this.logger.log(`📥 User [${user.id}] is chatting: ${chatDto.message}`);
    return this.agentService.chatWithAI(chatDto, user.id);
  }

  @Get('recommendations')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get AI-powered recommendations',
    description: 'Lấy các gợi ý hành động thông minh từ AI dựa trên hoạt động của người dùng.',
  })
  async getRecommendations(): Promise<AgentRecommendationDto[]> {
    this.logger.log('🤖 Getting AI recommendations');
    return this.agentService.getRecommendations();
  }
}