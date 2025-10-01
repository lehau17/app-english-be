import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AgentChatDto,
  AgentChatResponseDto,
  AgentRecommendationDto,
} from '../dto/agent.dto';
import { AgentService } from '../service/agent.service';
import { RagService } from '../service/rag.service';

@ApiTags('Agent')
@Controller('agent')
export class PrivateAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly ragService: RagService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat with AI Agent' })
  @ApiResponse({
    status: 200,
    description: 'AI response',
    type: AgentChatResponseDto,
  })
  async chat(@Body() chatDto: AgentChatDto): Promise<AgentChatResponseDto> {
    return this.agentService.chatWithAI(chatDto);
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get AI Recommendations' })
  @ApiResponse({
    status: 200,
    description: 'List of recommendations',
    type: [AgentRecommendationDto],
  })
  async getRecommendations(): Promise<AgentRecommendationDto[]> {
    return this.agentService.getRecommendations();
  }

  @Post('knowledge/reindex')
  @ApiOperation({
    summary: 'Reindex all model data into knowledge base',
    description:
      'Index courses, lessons, activities, and vocabulary into RAG knowledge base for searching',
  })
  @ApiResponse({
    status: 200,
    description: 'Reindexing results',
  })
  async reindexKnowledge() {
    const results = await this.ragService.reindexAllModels();
    return {
      success: true,
      message: 'Reindexing completed',
      results,
    };
  }

  @Post('knowledge/index-courses')
  @ApiOperation({ summary: 'Index only courses into knowledge base' })
  @ApiResponse({
    status: 200,
    description: 'Course indexing results',
  })
  async indexCourses() {
    const results = await this.ragService.indexCourses();
    return {
      success: true,
      message: 'Course indexing completed',
      ...results,
    };
  }

  @Post('knowledge/index-lessons')
  @ApiOperation({ summary: 'Index only lessons into knowledge base' })
  @ApiResponse({
    status: 200,
    description: 'Lesson indexing results',
  })
  async indexLessons() {
    const results = await this.ragService.indexLessons();
    return {
      success: true,
      message: 'Lesson indexing completed',
      ...results,
    };
  }

  @Post('knowledge/index-vocabulary')
  @ApiOperation({ summary: 'Index only vocabulary into knowledge base' })
  @ApiResponse({
    status: 200,
    description: 'Vocabulary indexing results',
  })
  async indexVocabulary() {
    const results = await this.ragService.indexVocabulary();
    return {
      success: true,
      message: 'Vocabulary indexing completed',
      ...results,
    };
  }

  @Post('knowledge/index-activities')
  @ApiOperation({ summary: 'Index only activities into knowledge base' })
  @ApiResponse({
    status: 200,
    description: 'Activity indexing results',
  })
  async indexActivities() {
    const results = await this.ragService.indexActivities();
    return {
      success: true,
      message: 'Activity indexing completed',
      ...results,
    };
  }
}

