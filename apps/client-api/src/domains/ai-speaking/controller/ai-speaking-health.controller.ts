import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiSpeakingHealthService } from '../service/ai-speaking-health.service';

@ApiTags('AI Speaking Health')
@Controller('/public/v1/ai-speaking')
export class AiSpeakingHealthController {
  constructor(private readonly healthService: AiSpeakingHealthService) {}

  @Get('/health')
  @ApiOperation({ summary: 'Check AI Speaking services health' })
  async health() {
    return {
      status: 'ok',
      services: {
        asr: {
          status: 'available',
          url: process.env.AI_SPEAKING_ASR_WS_URL || 'not configured',
        },
        tts: {
          status: 'available',
          useHttp: process.env.AI_SPEAKING_TTS_USE_HTTP === 'true',
          httpUrl: process.env.AI_SPEAKING_TTS_HTTP_URL || 'not configured',
          command: process.env.AI_SPEAKING_TTS_COMMAND || 'not configured',
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('/status')
  @ApiOperation({ summary: 'Simple status check' })
  async status() {
    return { status: 'ok', service: 'ai-speaking' };
  }
}
