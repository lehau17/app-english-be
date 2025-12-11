import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { AutoCertificateIssuerService } from '@app/shared/certificate';
import { Module } from '@nestjs/common';
import { GradebookModule } from '../gradebook';
import { GradebookService } from '../gradebook/service/gradebook.service';
import { NotificationModule } from '../notification/notification.module';
import {
  CertificateController,
  CertificateTemplateController,
  PublicCertificateController,
} from './controllers';
import { RateLimitGuard } from './guards/rate-limit.guard';
import {
  CertificateTemplateRepository,
  IssuedCertificateRepository,
} from './repository';
import { CertificateTemplateService } from './services/certificate-template.service';
import { IssuedCertificateService } from './services/issued-certificate.service';

@Module({
  imports: [DatabaseModule, GradebookModule, NotificationModule, SharedModule],
  controllers: [
    CertificateTemplateController,
    CertificateController,
    PublicCertificateController,
  ],
  providers: [
    CertificateTemplateRepository,
    IssuedCertificateRepository,
    CertificateTemplateService,
    IssuedCertificateService,
    RateLimitGuard,
    // Provide ICertificateIssuer interface implementation
    {
      provide: 'ICertificateIssuer',
      useExisting: IssuedCertificateService,
    },
    // Provide IGradebookService interface implementation
    {
      provide: 'IGradebookService',
      useExisting: GradebookService,
    },
    // Provide AutoCertificateIssuerService here where ICertificateIssuer is available
    AutoCertificateIssuerService,
  ],
  exports: [
    CertificateTemplateService,
    IssuedCertificateService,
    AutoCertificateIssuerService,
  ],
})
export class CertificateModule {}
