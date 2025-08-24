import { Module } from '@nestjs/common';
import { BackgroundWorkerController } from './background-worker.controller';
import { BackgroundWorkerService } from './background-worker.service';

@Module({
  imports: [],
  controllers: [BackgroundWorkerController],
  providers: [BackgroundWorkerService],
})
export class BackgroundWorkerModule {}
