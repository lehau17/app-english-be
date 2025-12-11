import { ExcelExportService, SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { GradebookController } from './controller';
import { GradebookRepository } from './repository';
import { GradebookExportService, GradebookService } from './service';

@Module({
  imports: [SharedModule],
  controllers: [GradebookController],
  providers: [GradebookService, GradebookExportService, GradebookRepository, ExcelExportService],
  exports: [GradebookService, GradebookExportService, GradebookRepository],
})
export class GradebookModule {}
















