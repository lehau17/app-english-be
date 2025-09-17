import { Module } from '@nestjs/common';
import { PrivateAssignmentController } from './controller';
import { AssignmentRepository } from './repository';
import { AssignmentService } from './service';

@Module({
  imports: [],
  controllers: [PrivateAssignmentController],
  providers: [AssignmentService, AssignmentRepository],
  exports: [AssignmentService, AssignmentRepository],
})
export class AssignmentModule {}
