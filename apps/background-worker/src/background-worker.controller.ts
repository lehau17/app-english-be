import { Controller, Get } from '@nestjs/common';
import { BackgroundWorkerService } from './background-worker.service';
import { TtsProcessorService } from './tts/tts-processor.service';

@Controller()
export class BackgroundWorkerController {
  constructor(
    private readonly backgroundWorkerService: BackgroundWorkerService,
    private readonly ttsProcessorService: TtsProcessorService,
  ) {}

  @Get()
  getHello(): string {
    return this.backgroundWorkerService.getHello();
  }

  @Get('health')
  async getHealth() {
    const ttsStats = await this.ttsProcessorService.getProcessingStats();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        backgroundWorker: { healthy: true },
        ttsProcessor: ttsStats,
      },
    };
  }
}
