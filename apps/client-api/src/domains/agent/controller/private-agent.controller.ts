import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AgentChatDto, AgentChatResponseDto, AgentRecommendationDto } from '../dto/agent.dto';
import { AgentService } from '../service/agent.service';

@ApiTags('Agent')
@Controller('agent')
export class PrivateAgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat with AI Agent' })
  @ApiResponse({ status: 200, description: 'AI response', type: AgentChatResponseDto })
  async chat(@Body() chatDto: AgentChatDto): Promise<AgentChatResponseDto> {
    return this.agentService.chatWithAI(chatDto);
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get AI Recommendations' })
  @ApiResponse({ status: 200, description: 'List of recommendations', type: [AgentRecommendationDto] })
  async getRecommendations(): Promise<AgentRecommendationDto[]> {
    return this.agentService.getRecommendations();
  }
}
