import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { Body, Controller, Get, Param, Post, Query, Res, Header } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { FinalizeAiSpeakingSessionDto } from '../dto/finalize-session.dto';
import { AiSpeakingSessionResponseDto } from '../dto/session-response.dto';
import { StartAiSpeakingSessionDto } from '../dto/start-session.dto';
import { SuggestionResponseDto } from '../dto/suggestion.dto';
import { VOICE_CATALOG, VoiceMetadata, VoicePreviewDto, parseVoice } from '../dto/tts-voice.dto';
import { AiSpeakingService } from '../service/ai-speaking.service';
import { SuggestionService } from '../service/suggestion.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@ApiTags('AI Speaking')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/ai-speaking')
export class AiSpeakingController {
  private readonly piperHttpUrl: string;

  constructor(
    private readonly aiSpeakingService: AiSpeakingService,
    private readonly suggestionService: SuggestionService,
    private readonly configService: ConfigService,
  ) {
    this.piperHttpUrl = this.configService.get<string>(
      'AI_SPEAKING_TTS_HTTP_URL',
      'http://localhost:8000',
    );
  }

  /**
   * GET /private/v1/ai-speaking/voices
   * Returns available TTS voices with metadata
   */
  @Get('voices')
  @ApiOperation({ summary: 'Get available TTS voices' })
  @ResponseMessage('Available TTS voices')
  getVoices(): { data: VoiceMetadata[] } {
    return { data: VOICE_CATALOG };
  }

  /**
   * POST /private/v1/ai-speaking/voices/preview
   * Generate and return audio preview for a voice
   */
  @Post('voices/preview')
  @ApiOperation({ summary: 'Preview a TTS voice with sample text' })
  @Header('Content-Type', 'audio/wav')
  async previewVoice(
    @Body() dto: VoicePreviewDto,
    @Res() res: Response,
  ): Promise<void> {
    const { model, speakerId } = parseVoice(dto.voice);
    const text = dto.text || 'Hello, this is a voice preview for AI speaking practice.';

    try {
      const response = await axios.post(
        `${this.piperHttpUrl}/api/tts`,
        {
          text,
          voice: model,
          speakerId,
          lengthScale: 1.0,
          noiseScale: 0.667,
          noiseW: 0.8,
        },
        {
          responseType: 'arraybuffer',
          timeout: 15000,
          headers: { 'Content-Type': 'application/json' },
        },
      );

      res.set({
        'Content-Type': 'audio/wav',
        'Content-Length': response.data.byteLength,
        'Cache-Control': 'public, max-age=3600',
      });
      res.send(Buffer.from(response.data));
    } catch (error) {
      res.status(500).json({
        message: 'Voice preview failed',
        error: error.message,
      });
    }
  }

  @Get('sessions/conversations')
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

  @Get('sessions/conversations/:conversationId')
  @ApiOperation({ summary: 'Lấy tất cả sessions trong một conversation' })
  @ResponseMessage('Chi tiết conversation')
  async getConversation(
    @PayloadToken() payload: JwtPayload,
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiSpeakingService.getConversation(payload.sub, conversationId);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Khởi tạo phiên luyện nói với AI' })
  @ResponseMessage('Tạo phiên luyện nói thành công')
  async startSession(
    @PayloadToken() payload: JwtPayload,
    @Body() dto: StartAiSpeakingSessionDto,
  ): Promise<AiSpeakingSessionResponseDto | null> {
    return this.aiSpeakingService.startSession(payload.sub, dto);
  }

  @Get('sessions')
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

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một phiên luyện nói' })
  @ResponseMessage('Thông tin phiên luyện nói')
  async getSession(
    @PayloadToken() payload: JwtPayload,
    @Param('id') id: string,
  ): Promise<AiSpeakingSessionResponseDto | null> {
    return this.aiSpeakingService.getSession(payload.sub, id);
  }

  @Post('sessions/:id/finalize')
  @ApiOperation({ summary: 'Kết thúc phiên luyện nói và tạo tổng kết' })
  @ResponseMessage('Đã kết thúc phiên luyện nói')
  async finalizeSession(
    @PayloadToken() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: FinalizeAiSpeakingSessionDto,
  ): Promise<AiSpeakingSessionResponseDto | null> {
    return this.aiSpeakingService.finalizeSession(payload.sub, id, dto);
  }

  @Get('sessions/:sessionId/suggestions')
  @ApiOperation({ summary: 'Lấy gợi ý câu trả lời cho session hiện tại' })
  @ResponseMessage('Gợi ý câu trả lời')
  async getSuggestions(
    @Param('sessionId') sessionId: string,
  ): Promise<SuggestionResponseDto> {
    const suggestions = await this.suggestionService.getSuggestions(sessionId);
    return { suggestions };
  }
}
