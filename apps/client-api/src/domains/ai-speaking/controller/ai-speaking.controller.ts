import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinalizeAiSpeakingSessionDto } from '../dto/finalize-session.dto';
import { AiSpeakingSessionResponseDto } from '../dto/session-response.dto';
import { StartAiSpeakingSessionDto } from '../dto/start-session.dto';
import { AiSpeakingService } from '../service/ai-speaking.service';

@ApiTags('AI Speaking')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/ai-speaking/sessions')
export class AiSpeakingController {
  constructor(private readonly aiSpeakingService: AiSpeakingService) {}

  @Get('/conversations')
  @ApiOperation({ summary: 'Danh sách conversations (nhóm sessions)' })
  @ResponseMessage('Danh sách conversations')
  async listConversations(
    @PayloadToken() payload: JwtPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = typeof limit === 'string' ? Number(limit) : undefined;
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;

    return this.aiSpeakingService.listConversations(payload.sub, {
      limit: safeLimit,
      cursor,
    });
  }

  @Get('/conversations/:conversationId')
  @ApiOperation({ summary: 'Lấy tất cả sessions trong một conversation' })
  @ResponseMessage('Chi tiết conversation')
  async getConversation(
    @PayloadToken() payload: JwtPayload,
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiSpeakingService.getConversation(payload.sub, conversationId);
  }

  @Post()
  @ApiOperation({ summary: 'Khởi tạo phiên luyện nói với AI' })
  @ResponseMessage('Tạo phiên luyện nói thành công')
  async startSession(
    @PayloadToken() payload: JwtPayload,
    @Body() dto: StartAiSpeakingSessionDto,
  ): Promise<AiSpeakingSessionResponseDto | null> {
    return this.aiSpeakingService.startSession(payload.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách phiên luyện nói gần đây' })
  @ResponseMessage('Danh sách phiên luyện nói')
  async listSessions(
    @PayloadToken() payload: JwtPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<AiSpeakingSessionResponseDto[]> {
    const parsedLimit =
      typeof limit === 'string' ? Number(limit) : Number(limit ?? undefined);
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;

    return this.aiSpeakingService.listSessions(payload.sub, {
      limit: safeLimit,
      cursor,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một phiên luyện nói' })
  @ResponseMessage('Thông tin phiên luyện nói')
  async getSession(
    @PayloadToken() payload: JwtPayload,
    @Param('id') id: string,
  ): Promise<AiSpeakingSessionResponseDto | null> {
    return this.aiSpeakingService.getSession(payload.sub, id);
  }

  @Post(':id/finalize')
  @ApiOperation({ summary: 'Kết thúc phiên luyện nói và tạo tổng kết' })
  @ResponseMessage('Đã kết thúc phiên luyện nói')
  async finalizeSession(
    @PayloadToken() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: FinalizeAiSpeakingSessionDto,
  ): Promise<AiSpeakingSessionResponseDto | null> {
    return this.aiSpeakingService.finalizeSession(payload.sub, id, dto);
  }
}
