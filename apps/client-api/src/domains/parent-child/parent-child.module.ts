import { Module } from '@nestjs/common';
import { PrivateParentChildController } from './controller';
import { ParentChildLinkRequestRepository, ParentChildRepository } from './repository';
import { ParentChildService } from './service';

@Module({
    controllers: [PrivateParentChildController],
    providers: [ParentChildService, ParentChildRepository, ParentChildLinkRequestRepository],
    exports: [ParentChildService],
})
export class ParentChildModule { }
