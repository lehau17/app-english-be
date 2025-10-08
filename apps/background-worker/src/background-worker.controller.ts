import { Controller, Get } from '@nestjs/common';
import { BackgroundWorkerService } from './background-worker.service';

@Controller()
export class BackgroundWorkerController {
  constructor(private readonly backgroundWorkerService: BackgroundWorkerService) {}

  @Get()
  getHello(): string {
    return this.backgroundWorkerService.getHello();
  }

  @Get('health')
  async getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        backgroundWorker: { healthy: true },
        kafkaListeners: {
          tts: 'running',
          neo4jSync: 'running',
        },
      },
    };
  }
}
