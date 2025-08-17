import { Module } from '@nestjs/common';
import { PrivateProgressController } from './controller';
import { ProgressService } from './service';
import { ProgressRepository } from './repository';

@Module({
  controllers: [PrivateProgressController],
  providers: [ProgressService, ProgressRepository],
})
export class ProgressModule {}
