import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CertificateRequirementType,
  CertificateTemplate,
} from '@prisma/client';
import {
  CreateCertificateTemplateDto,
  UpdateCertificateTemplateDto,
} from '../dto';
import { CertificateTemplateRepository } from '../repository';

@Injectable()
export class CertificateTemplateService {
  private readonly logger = new Logger(CertificateTemplateService.name);

  constructor(private readonly templateRepo: CertificateTemplateRepository) {}

  /**
   * Create default certificate template for a course
   */
  async createDefaultTemplate(courseId: string): Promise<CertificateTemplate> {
    this.logger.log(
      `Creating default certificate template for course ${courseId}`,
    );

    // Check if template already exists
    const existing = await this.templateRepo.findByCourseId(courseId);
    if (existing) {
      throw new ConflictException(
        'Certificate template already exists for this course',
      );
    }

    // Create default template
    const template = await this.templateRepo.create({
      course: {
        connect: { id: courseId },
      },
      title: 'Certificate of Completion',
      description:
        'This certificate is awarded for successfully completing the course',
      issuerName: 'English Learning Platform',
      issuerTitle: 'Director of Education',
      requirementType: CertificateRequirementType.course_completion,
      minProgress: 100,
      isActive: true,
      layout: this.getDefaultLayout(),
    });

    this.logger.log(
      `Created certificate template ${template.id} for course ${courseId}`,
    );
    return template;
  }

  /**
   * Create custom certificate template
   */
  async create(
    dto: CreateCertificateTemplateDto,
  ): Promise<CertificateTemplate> {
    this.logger.log(`Creating certificate template for course ${dto.courseId}`);

    // Check if template already exists
    const existing = await this.templateRepo.findByCourseId(dto.courseId);
    if (existing) {
      throw new ConflictException(
        'Certificate template already exists for this course',
      );
    }

    const template = await this.templateRepo.create({
      course: {
        connect: { id: dto.courseId },
      },
      title: dto.title || 'Certificate of Completion',
      description: dto.description,
      issuerName: dto.issuerName || 'English Learning Platform',
      issuerTitle: dto.issuerTitle || 'Director of Education',
      issuerSignature: dto.issuerSignature,
      logoUrl: dto.logoUrl,
      requirementType:
        dto.requirementType || CertificateRequirementType.course_completion,
      minScore: dto.minScore,
      minProgress: dto.minProgress || 100,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      layout: dto.layout || this.getDefaultLayout(),
    });

    this.logger.log(`Created certificate template ${template.id}`);
    return template;
  }

  /**
   * Get template by course ID
   */
  async getTemplateByCourseId(courseId: string): Promise<CertificateTemplate> {
    const template = await this.templateRepo.findByCourseId(courseId);
    if (!template) {
      throw new NotFoundException(
        `Certificate template not found for course ${courseId}`,
      );
    }
    return template;
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<CertificateTemplate> {
    const template = await this.templateRepo.findById(id);
    if (!template) {
      throw new NotFoundException(
        `Certificate template not found with id ${id}`,
      );
    }
    return template;
  }

  /**
   * Update template
   */
  async update(
    id: string,
    dto: UpdateCertificateTemplateDto,
  ): Promise<CertificateTemplate> {
    this.logger.log(`Updating certificate template ${id}`);

    await this.getTemplateById(id); // Check if exists

    const template = await this.templateRepo.update(id, {
      ...(dto.title && { title: dto.title }),
      ...(dto.description && { description: dto.description }),
      ...(dto.issuerName && { issuerName: dto.issuerName }),
      ...(dto.issuerTitle && { issuerTitle: dto.issuerTitle }),
      ...(dto.issuerSignature && { issuerSignature: dto.issuerSignature }),
      ...(dto.logoUrl && { logoUrl: dto.logoUrl }),
      ...(dto.requirementType && { requirementType: dto.requirementType }),
      ...(dto.minScore !== undefined && { minScore: dto.minScore }),
      ...(dto.minProgress !== undefined && { minProgress: dto.minProgress }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.layout && { layout: dto.layout }),
    });

    this.logger.log(`Updated certificate template ${id}`);
    return template;
  }

  /**
   * Delete template
   */
  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting certificate template ${id}`);

    await this.getTemplateById(id); // Check if exists
    await this.templateRepo.delete(id);

    this.logger.log(`Deleted certificate template ${id}`);
  }

  /**
   * Get all templates
   */
  async findAll(params?: {
    skip?: number;
    take?: number;
    isActive?: boolean;
  }): Promise<{ data: CertificateTemplate[]; total: number }> {
    const where =
      params?.isActive !== undefined
        ? { isActive: params.isActive }
        : undefined;

    const [data, total] = await Promise.all([
      this.templateRepo.findMany({
        skip: params?.skip,
        take: params?.take,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.templateRepo.count(where),
    ]);

    return { data, total };
  }

  /**
   * Get default certificate layout
   */
  private getDefaultLayout() {
    return {
      template: 'classic-elegant',
      background: {
        type: 'color',
        color: '#ffffff',
      },
      border: {
        enabled: true,
        style: 'classic',
        color: '#1a365d',
        width: 20,
      },
      header: {
        logo: {
          enabled: true,
          position: 'center',
        },
        title: {
          fontSize: 48,
          fontFamily: 'Georgia',
          color: '#1a365d',
          fontWeight: 'bold',
        },
      },
      body: {
        studentName: {
          fontSize: 36,
          fontFamily: 'Georgia',
          color: '#2d3748',
          fontWeight: 'bold',
          transform: 'uppercase',
        },
        courseName: {
          fontSize: 28,
          fontFamily: 'Georgia',
          color: '#1a365d',
          fontStyle: 'italic',
        },
      },
      footer: {
        signature: {
          enabled: true,
          position: 'center',
        },
        qrCode: {
          enabled: true,
          size: 100,
          position: 'bottom-right',
        },
      },
    };
  }
}
