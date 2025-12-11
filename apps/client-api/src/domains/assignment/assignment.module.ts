import { SharedModule } from '@app/shared';
import { Module, forwardRef } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { CertificateModule } from '../certificate/certificate.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { EvaluationService } from '../evaluation/service/evaluation.service';
import { GradebookModule } from '../gradebook';
import { MediaModule } from '../media/media.module';
import { PrivateAssignmentController } from './controller';
import { AssignmentRepository } from './repository';
import { AssignmentService } from './service';
import { AssignmentImportService } from './services/assignment-import.service';
import { AssignmentPdfService } from './services/assignment-pdf.service';

@Module({
  imports: [
    SharedModule,
    EvaluationModule,
    EventsModule,
    GradebookModule,
    forwardRef(() => CertificateModule),
    MediaModule,
  ],
  controllers: [PrivateAssignmentController],
  providers: [
    AssignmentService,
    AssignmentRepository,
    AssignmentImportService,
    AssignmentPdfService,
    EvaluationService,
  ],
  exports: [
    AssignmentService,
    AssignmentRepository,
    AssignmentImportService,
    AssignmentPdfService,
  ],
})
export class AssignmentModule {}
