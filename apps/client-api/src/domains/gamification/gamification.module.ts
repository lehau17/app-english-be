import { Module } from '@nestjs/common';
import { PrismaRepository } from '@app/database';
import { GamificationService } from './service/gamification.service';
import { GamificationController } from './controller/gamification.controller';

@Module({
  providers: [GamificationService, PrismaRepository],
  controllers: [GamificationController],
  exports: [GamificationService],
})
export class GamificationModule {}
