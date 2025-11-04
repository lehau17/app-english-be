import { PartialType } from '@nestjs/swagger';
import { CreateCertificateTemplateDto } from './create-certificate-template.dto';

export class UpdateCertificateTemplateDto extends PartialType(
  CreateCertificateTemplateDto,
) {}
