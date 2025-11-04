import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import {
  CertificateController,
  CertificateTemplateController,
} from './controllers';
import {
  CertificateTemplateRepository,
  IssuedCertificateRepository,
} from './repository';
import {
  AutoCertificateIssuerService,
  CertificateTemplateService,
  IssuedCertificateService,
} from './services';

@Module({
  imports: [DatabaseModule],
  controllers: [CertificateTemplateController, CertificateController],
  providers: [
    CertificateTemplateRepository,
    IssuedCertificateRepository,
    CertificateTemplateService,
    IssuedCertificateService,
    AutoCertificateIssuerService,
  ],
  exports: [
    CertificateTemplateService,
    IssuedCertificateService,
    AutoCertificateIssuerService,
  ],
})
export class CertificateModule {}
