import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LinkRequestStatus, ParentChild, UserRole } from '@prisma/client';
import {
  CreateParentChildDto,
  FilterParentChildRequestDto,
} from '../dto/parent-child.dto';
import {
  FilterLinkRequestDto,
  ParentChildLinkRequestRepository,
} from '../repository/parent-child-link-request.repository';
import { ParentChildRepository } from '../repository/parent-child.repository';

@Injectable()
export class ParentChildService {
  constructor(
    private readonly parentChildRepository: ParentChildRepository,
    private readonly linkRequestRepository: ParentChildLinkRequestRepository,
    private readonly prisma: PrismaRepository,
  ) {}

  async create(dto: CreateParentChildDto): Promise<ParentChild> {
    return this.parentChildRepository.create(dto);
  }

  async linkParentToChild(
    parentId: string,
    childId: string,
  ): Promise<ParentChild> {
    // Prevent duplicate link
    const existing = await this.parentChildRepository.findById(
      parentId,
      childId,
    );
    if (existing) {
      return existing;
    }
    return this.parentChildRepository.create({ parentId, childId });
  }

  async unlinkParentFromChild(
    parentId: string,
    childId: string,
  ): Promise<ParentChild> {
    await this.ensureExists(parentId, childId);
    return this.parentChildRepository.delete(parentId, childId);
  }

  async getChildrenOfParent(parentId: string): Promise<ParentChild[]> {
    // List all children for a parent
    return this.parentChildRepository.findManyByParentId(parentId);
  }

  async getParentsOfChild(childId: string): Promise<ParentChild[]> {
    // List all parents for a child
    return this.parentChildRepository.findManyByChildId(childId);
  }

  async findById(parentId: string, childId: string): Promise<ParentChild> {
    const parentChild = await this.parentChildRepository.findById(
      parentId,
      childId,
    );
    if (!parentChild) {
      throw new NotFoundException(
        `ParentChild with parentId ${parentId} and childId ${childId} not found`,
      );
    }
    return parentChild;
  }

  async delete(parentId: string, childId: string): Promise<ParentChild> {
    await this.ensureExists(parentId, childId);
    return this.parentChildRepository.delete(parentId, childId);
  }

  async list(
    params: FilterParentChildRequestDto,
  ): Promise<PageResponseDto<ParentChild>> {
    return this.parentChildRepository.list(params);
  }

  private async ensureExists(parentId: string, childId: string): Promise<void> {
    const exists = await this.parentChildRepository.findById(parentId, childId);
    if (!exists) {
      throw new NotFoundException(
        `ParentChild with parentId ${parentId} and childId ${childId} not found`,
      );
    }
  }

  // ==================== LINK REQUEST METHODS ====================

  /**
   * Tạo yêu cầu liên kết từ parent đến student
   * @param parentId ID của parent
   * @param studentIdentifier Email của student (trong tương lai có thể thêm studentCode)
   */
  async createLinkRequest(parentId: string, studentIdentifier: string) {
    // 1. Tìm student by email (TODO: có thể thêm studentCode sau)
    const student = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: studentIdentifier },
          // TODO: Nếu có trường studentCode trong User model, uncomment dòng này:
          // { studentCode: studentIdentifier },
        ],
        role: UserRole.student,
      },
    });

    if (!student) {
      throw new NotFoundException(
        `Student with identifier "${studentIdentifier}" not found`,
      );
    }

    // 2. Kiểm tra xem đã liên kết chưa
    const existingLink = await this.parentChildRepository.findById(
      parentId,
      student.id,
    );
    if (existingLink) {
      throw new ConflictException('Parent and student are already linked');
    }

    // 3. Kiểm tra xem đã có pending request chưa
    const pendingRequest =
      await this.linkRequestRepository.findPendingByParentAndStudent(
        parentId,
        student.id,
      );
    if (pendingRequest) {
      throw new ConflictException(
        'A pending link request already exists for this parent and student',
      );
    }

    // 4. Tạo link request mới
    const linkRequest = await this.linkRequestRepository.create({
      parentId,
      studentId: student.id,
    });

    // TODO: Optional - Gửi notification qua Kafka
    // await this.kafkaProducerService.send({
    //   topic: 'notification-created',
    //   messages: [{
    //     value: JSON.stringify({
    //       type: 'parent_child_link_request',
    //       linkRequestId: linkRequest.id,
    //     }),
    //   }],
    // });

    return linkRequest;
  }

  /**
   * Lấy danh sách các link request đang pending
   */
  async getPendingRequests(params: FilterLinkRequestDto) {
    return this.linkRequestRepository.list({
      ...params,
      status: LinkRequestStatus.PENDING,
    });
  }

  /**
   * Admin/Teacher approve link request
   */
  async approveLinkRequest(requestId: string, adminUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Tìm request
      const request = await tx.parentChildLinkRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new NotFoundException(
          `Link request with id ${requestId} not found`,
        );
      }

      if (request.status !== LinkRequestStatus.PENDING) {
        throw new BadRequestException(
          `Link request is not pending (current status: ${request.status})`,
        );
      }

      // 2. Kiểm tra xem đã link chưa (race condition protection)
      const existingLink = await tx.parentChild.findUnique({
        where: {
          parentId_childId: {
            parentId: request.parentId,
            childId: request.studentId,
          },
        },
      });

      // 3. Tạo link nếu chưa tồn tại
      if (!existingLink) {
        await tx.parentChild.create({
          data: {
            parentId: request.parentId,
            childId: request.studentId,
            // TODO: Nếu đã implement Prompt 2, thêm trường isVerifiedByAdmin: false
          },
        });
      }

      // 4. Cập nhật request status
      const updatedRequest = await tx.parentChildLinkRequest.update({
        where: { id: requestId },
        data: {
          status: LinkRequestStatus.APPROVED,
          resolvedAt: new Date(),
          resolvedById: adminUserId,
        },
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

      // TODO: Optional - Gửi notification cho parent và student
      // await this.kafkaProducerService.send(...)

      return updatedRequest;
    });
  }

  /**
   * Admin/Teacher reject link request
   */
  async rejectLinkRequest(requestId: string, adminUserId: string) {
    // 1. Tìm request
    const request = await this.linkRequestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundException(
        `Link request with id ${requestId} not found`,
      );
    }

    if (request.status !== LinkRequestStatus.PENDING) {
      throw new BadRequestException(
        `Link request is not pending (current status: ${request.status})`,
      );
    }

    // 2. Cập nhật status
    const updatedRequest = await this.linkRequestRepository.update(requestId, {
      status: LinkRequestStatus.REJECTED,
      resolvedAt: new Date(),
      resolvedBy: { connect: { id: adminUserId } },
    });

    // TODO: Optional - Gửi notification cho parent
    // await this.kafkaProducerService.send(...)

    return updatedRequest;
  }
}
