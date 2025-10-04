import { Body, Controller, Get, Post, Query, Res, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PayloadToken } from '@app/shared';
import { JwtPayload } from '@app/shared/payload';
import { Response } from 'express';
import {
  AgentChatDto,
  AgentChatResponseDto,
  AgentRecommendationDto,
} from '../dto/agent.dto';
import { AgentService } from '../service/agent.service';
import { AutoReindexService } from '../service/auto-reindex.service';
import { RagService } from '../service/rag.service';

@ApiTags('Agent')
@Controller('/private/v1/agent')
export class PrivateAgentController {
  private readonly logger = new Logger(PrivateAgentController.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly ragService: RagService,
    private readonly autoReindexService: AutoReindexService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat with AI Agent' })
  @ApiResponse({
    status: 200,
    description: 'AI response',
    type: AgentChatResponseDto,
  })
  async chat(
    @Body() chatDto: AgentChatDto,
    @PayloadToken() payload: JwtPayload,
  ): Promise<AgentChatResponseDto> {
    return this.agentService.chatWithAI(chatDto, payload.sub);
  }

  @Get('chat/stream')
  @ApiOperation({ summary: 'Stream chat with AI Agent using SSE' })
  @ApiResponse({
    status: 200,
    description: 'SSE stream of AI response',
  })
  async streamChat(
    @Query('message') message: string,
    @Query('conversationId') conversationId: string | undefined,
    @PayloadToken() payload: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(
      `🌊 Stream request: message="${message}" conversationId=${conversationId} userId=${payload.sub}`,
    );

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    try {
      const chatDto: AgentChatDto = {
        message,
        conversationId,
      };

      let chunkCount = 0;
      for await (const chunk of this.agentService.streamChatWithAI(
        chatDto,
        payload.sub,
      )) {
        chunkCount++;
        const data = JSON.stringify(chunk);
        this.logger.debug(`📤 Chunk ${chunkCount}: ${data.substring(0, 100)}...`);
        res.write(`data: ${data}\n\n`);
        
        // Flush the response to ensure data is sent immediately
        if ((res as any).flush) {
          (res as any).flush();
        }
      }

      this.logger.log(`✅ Stream completed: ${chunkCount} chunks sent`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      this.logger.error(`❌ Stream error: ${error.message}`, error.stack);
      res.write(
        `data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`,
      );
      res.end();
    }
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

  @Get('conversations')
  @ApiOperation({ summary: 'Get user conversations with AI agent' })
  @ApiResponse({
    status: 200,
    description: 'List of conversations',
  })
  async getConversations(
    @PayloadToken() payload: JwtPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    return this.agentService.getUserConversations(
      payload.sub,
      parsedLimit,
      parsedOffset,
    );
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation details with messages' })
  @ApiResponse({
    status: 200,
    description: 'Conversation with messages',
  })
  async getConversation(
    @PayloadToken() payload: JwtPayload,
    @Query('id') conversationId: string,
  ) {
    return this.agentService.getConversation(conversationId, payload.sub);
  }

  @Post('conversations/:id/delete')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiResponse({
    status: 200,
    description: 'Conversation deleted',
  })
  async deleteConversation(
    @PayloadToken() payload: JwtPayload,
    @Query('id') conversationId: string,
  ) {
    await this.agentService.deleteConversation(conversationId, payload.sub);
    return { success: true, message: 'Conversation deleted successfully' };
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

  @Get('knowledge/auto-reindex/status')
  @ApiOperation({
    summary: 'Get auto-reindex status and statistics',
    description:
      'Check if auto-reindex is enabled and get statistics about knowledge base',
  })
  @ApiResponse({
    status: 200,
    description: 'Auto-reindex status and stats',
  })
  async getAutoReindexStatus() {
    const stats = await this.autoReindexService.getStats();
    return {
      success: true,
      message: 'Auto-reindex status retrieved',
      ...stats,
    };
  }

  @Post('knowledge/auto-reindex/trigger')
  @ApiOperation({
    summary: 'Manually trigger auto-reindex for specific entity',
    description:
      'Manually trigger reindexing for a specific course, lesson, activity, or vocabulary',
  })
  @ApiResponse({
    status: 200,
    description: 'Manual reindex triggered',
  })
  async triggerManualReindex(
    @Query('model') model: string,
    @Query('id') id: string,
    @Query('action') action: 'create' | 'update' | 'delete' = 'update',
  ) {
    if (!model || !id) {
      throw new Error('Model and ID are required');
    }

    if (
      !['course', 'lesson', 'activity', 'vocabulary'].includes(
        model.toLowerCase(),
      )
    ) {
      throw new Error(
        'Invalid model. Must be one of: course, lesson, activity, vocabulary',
      );
    }

    await this.autoReindexService.manualReindex(model, id, action);

    return {
      success: true,
      message: `Manual reindex triggered for ${model} ${id}`,
      model,
      id,
      action,
    };
  }
}
