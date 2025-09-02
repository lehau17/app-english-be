import { Module } from '@nestjs/common';
import { BackgroundWorkerController } from './background-worker.controller';
import { BackgroundWorkerService } from './background-worker.service';
import { DashboardModule } from './dashboard/dashboard.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [DashboardModule, ScheduleModule.forRoot()],
  controllers: [BackgroundWorkerController],
  providers: [BackgroundWorkerService],
})
export class BackgroundWorkerModule {}
