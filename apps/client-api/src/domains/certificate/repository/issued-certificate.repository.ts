import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { IssuedCertificate, Prisma } from '@prisma/client';

@Injectable()
export class IssuedCertificateRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async create(
    data: Prisma.IssuedCertificateCreateInput,
  ): Promise<IssuedCertificate> {
    return this.prisma.issuedCertificate.create({ data });
  }

  async findById(id: string): Promise<IssuedCertificate | null> {
    return this.prisma.issuedCertificate.findUnique({
      where: { id },
      include: {
        template: true,
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        classroom: {
          select: {
            id: true,
            name: true,
            classCode: true,
          },
        },
      },
    });
  }

  async findByCertificateNumber(
    certificateNumber: string,
  ): Promise<IssuedCertificate | null> {
    return this.prisma.issuedCertificate.findUnique({
      where: { certificateNumber },
      include: {
        template: true,
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
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

  async findByVerificationCode(
    verificationCode: string,
  ): Promise<IssuedCertificate | null> {
    return this.prisma.issuedCertificate.findUnique({
      where: { verificationCode },
      include: {
        template: true,
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
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

  async findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<IssuedCertificate | null> {
    return this.prisma.issuedCertificate.findFirst({
      where: {
        studentId,
        courseId,
      },
      include: {
        template: true,
      },
    });
  }

  async update(
    id: string,
    data: Prisma.IssuedCertificateUpdateInput,
  ): Promise<IssuedCertificate> {
    return this.prisma.issuedCertificate.update({
      where: { id },
      data,
    });
  }

  async findMany(params?: {
    skip?: number;
    take?: number;
    where?: Prisma.IssuedCertificateWhereInput;
    orderBy?: Prisma.IssuedCertificateOrderByWithRelationInput;
  }): Promise<IssuedCertificate[]> {
    return this.prisma.issuedCertificate.findMany({
      ...params,
      include: {
        template: true,
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
          },
        },
        classroom: {
          select: {
            id: true,
            name: true,
            classCode: true,
          },
        },
      },
    });
  }

  async count(where?: Prisma.IssuedCertificateWhereInput): Promise<number> {
    return this.prisma.issuedCertificate.count({ where });
  }

  async revoke(id: string, reason: string): Promise<IssuedCertificate> {
    return this.prisma.issuedCertificate.update({
      where: { id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }
}
