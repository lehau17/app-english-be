import { Controller, Get } from '@nestjs/common';
import { BackgroundWorkerService } from './background-worker.service';

@Controller()
export class BackgroundWorkerController {
  constructor(
    private readonly backgroundWorkerService: BackgroundWorkerService,
  ) {}

  @Get()
  getHello(): string {
    return this.backgroundWorkerService.getHello();
  }
}
