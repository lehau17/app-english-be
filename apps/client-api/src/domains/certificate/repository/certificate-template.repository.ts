import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { CertificateTemplate, Prisma } from '@prisma/client';

@Injectable()
export class CertificateTemplateRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async create(
    data: Prisma.CertificateTemplateCreateInput,
  ): Promise<CertificateTemplate> {
    return this.prisma.certificateTemplate.create({ data });
  }

  async findById(id: string): Promise<CertificateTemplate | null> {
    return this.prisma.certificateTemplate.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
    });
  }

  async findByCourseId(courseId: string): Promise<CertificateTemplate | null> {
    return this.prisma.certificateTemplate.findUnique({
      where: { courseId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    data: Prisma.CertificateTemplateUpdateInput,
  ): Promise<CertificateTemplate> {
    return this.prisma.certificateTemplate.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<CertificateTemplate> {
    return this.prisma.certificateTemplate.delete({
      where: { id },
    });
  }

  async findMany(params?: {
    skip?: number;
    take?: number;
    where?: Prisma.CertificateTemplateWhereInput;
    orderBy?: Prisma.CertificateTemplateOrderByWithRelationInput;
  }): Promise<CertificateTemplate[]> {
    return this.prisma.certificateTemplate.findMany({
      ...params,
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  async count(where?: Prisma.CertificateTemplateWhereInput): Promise<number> {
    return this.prisma.certificateTemplate.count({ where });
  }
}
