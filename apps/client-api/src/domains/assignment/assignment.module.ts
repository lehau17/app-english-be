import { SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { PrivateAssignmentController } from './controller';
import { AssignmentRepository } from './repository';
import { AssignmentService } from './service';
import { AssignmentImportService } from './services/assignment-import.service';
import { AssignmentPdfService } from './services/assignment-pdf.service';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { EventsModule } from '../../events/events.module';
import { EvaluationService } from '../evaluation/service/evaluation.service';

@Module({
  imports: [SharedModule, EvaluationModule, EventsModule],
  controllers: [PrivateAssignmentController],
  providers: [
    AssignmentService,
    AssignmentRepository,
    AssignmentImportService,
    AssignmentPdfService,
    EvaluationService
  ],
  exports: [
    AssignmentService,
    AssignmentRepository,
    AssignmentImportService,
    AssignmentPdfService,
  ],
})
export class AssignmentModule { }
