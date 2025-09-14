import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { PrivateParentController } from './controller';
import { ParentService } from './service';

@Module({
  imports: [DatabaseModule],
  controllers: [PrivateParentController],
  providers: [ParentService],
  exports: [ParentService],
})
export class ParentModule {}
