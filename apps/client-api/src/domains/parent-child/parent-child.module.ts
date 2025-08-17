import { Module } from '@nestjs/common';
import { PrivateParentChildController } from './controller';
import { ParentChildService } from './service';
import { ParentChildRepository } from './repository';

@Module({
  controllers: [PrivateParentChildController],
  providers: [ParentChildService, ParentChildRepository],
})
export class ParentChildModule {}
