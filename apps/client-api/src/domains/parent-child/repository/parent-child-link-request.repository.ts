import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import {
  LinkInitiatedBy,
  LinkRequestStatus,
  ParentChildLinkRequest,
  Prisma,
} from '@prisma/client';

export interface CreateLinkRequestDto {
  parentId: string;
  studentId: string;
  initiatedBy?: LinkInitiatedBy;
  invitationCode?: string;
  invitedEmail?: string;
  expiresAt?: Date;
  status?: LinkRequestStatus;
}

export interface FilterLinkRequestDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: LinkRequestStatus;
  parentId?: string;
  studentId?: string;
}

@Injectable()
export class ParentChildLinkRequestRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async create(data: CreateLinkRequestDto): Promise<ParentChildLinkRequest> {
    return this.prisma.parentChildLinkRequest.create({ data });
  }

  async findById(id: string): Promise<ParentChildLinkRequest | null> {
    return this.prisma.parentChildLinkRequest.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        student: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        resolvedBy: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });
  }

  async findByParentAndStudent(
    parentId: string,
    studentId: string,
  ): Promise<ParentChildLinkRequest | null> {
    return this.prisma.parentChildLinkRequest.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
  }

  async findPendingByParentAndStudent(
    parentId: string,
    studentId: string,
  ): Promise<ParentChildLinkRequest | null> {
    return this.prisma.parentChildLinkRequest.findFirst({
      where: {
        parentId,
        studentId,
        status: LinkRequestStatus.PENDING,
      },
    });
  }

  async list(
    params: FilterLinkRequestDto,
  ): Promise<PageResponseDto<ParentChildLinkRequest>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'requestedAt',
      sortOrder = 'desc',
      status,
      parentId,
      studentId,
    } = params;

    const where: Prisma.ParentChildLinkRequestWhereInput = {
      ...(status && { status }),
      ...(parentId && { parentId }),
      ...(studentId && { studentId }),
    };

    const totalItems = await this.prisma.parentChildLinkRequest.count({
      where,
    });
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const data = await this.prisma.parentChildLinkRequest.findMany({
      where,
      skip: (safePage - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        parent: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        student: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        resolvedBy: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });

    return PageResponseDto.of(data, safePage, limit, totalItems);
  }

  async update(
    id: string,
    data: Prisma.ParentChildLinkRequestUpdateInput,
  ): Promise<ParentChildLinkRequest> {
    return this.prisma.parentChildLinkRequest.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<ParentChildLinkRequest> {
    return this.prisma.parentChildLinkRequest.delete({
      where: { id },
    });
  }

  async cancelPendingByEmail(
    studentId: string,
    invitedEmail: string,
  ): Promise<void> {
    await this.prisma.parentChildLinkRequest.updateMany({
      where: {
        studentId,
        invitedEmail,
        status: LinkRequestStatus.PENDING,
      },
      data: {
        status: LinkRequestStatus.CANCELLED,
        resolvedAt: new Date(),
      },
    });
  }

  async findManyByStudent(
    studentId: string,
    status?: LinkRequestStatus,
  ): Promise<ParentChildLinkRequest[]> {
    return this.prisma.parentChildLinkRequest.findMany({
      where: {
        studentId,
        ...(status && { status }),
      },
      orderBy: { requestedAt: 'desc' },
      include: {
        parent: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        student: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findByInvitationCode(
    invitationCode: string,
  ): Promise<ParentChildLinkRequest | null> {
    return this.prisma.parentChildLinkRequest.findUnique({
      where: { invitationCode },
      include: {
        parent: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        student: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
