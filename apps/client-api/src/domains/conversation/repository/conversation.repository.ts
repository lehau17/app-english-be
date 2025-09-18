import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { ConversationType, MessageType, Prisma } from '@prisma/client';

const conversationInclude = {
  participants: {
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          role: true,
          avatarUrl: true,
        },
      },
    },
  },
  createdBy: {
    select: {
      id: true,
      displayName: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
  lastMessageSender: {
    select: {
      id: true,
      displayName: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
  _count: {
    select: {
      messages: true,
    },
  },
} satisfies Prisma.ConversationInclude;

export type ConversationWithRelations = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;

interface ListConversationParams {
  userId: string;
  classroomId: string;
  type?: ConversationType;
  skip: number;
  take: number;
}

interface CreateConversationParams {
  classroomId: string;
  createdById: string;
  scopeKey: string;
  type: ConversationType;
  name?: string;
  metadata?: Record<string, any>;
  participantIds: string[];
}

interface CreateMessageParams {
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  metadata?: Record<string, any>;
  attachments?: Record<string, any>;
}

@Injectable()
export class ConversationRepository extends PrismaRepository {
  private conversationInclude = {
    participants: {
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    },
    createdBy: {
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    },
    lastMessageSender: {
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    },
    _count: {
      select: {
        messages: true,
      },
    },
  } satisfies Prisma.ConversationInclude;

  async listConversations(params: ListConversationParams) {
    const where: Prisma.ConversationWhereInput = {
      classroomId: params.classroomId,
      participants: {
        some: {
          userId: params.userId,
        },
      },
      ...(params.type && { type: params.type }),
    };

    const [total, conversations] = await this.$transaction([
      this.conversation.count({ where }),
      this.conversation.findMany({
        where,
        include: conversationInclude,
        orderBy: {
          lastMessageAt: 'desc',
        },
        skip: params.skip,
        take: params.take,
      }),
    ]);

    return { total, conversations };
  }

  async findConversationForUser(conversationId: string, userId: string) {
    return this.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId,
          },
        },
      },
      include: conversationInclude,
    });
  }

  async findConversationByScope(scopeKey: string) {
    return this.conversation.findUnique({
      where: { scopeKey },
      include: conversationInclude,
    });
  }

  async createConversation(params: CreateConversationParams) {
    return this.conversation.create({
      data: {
        classroomId: params.classroomId,
        createdById: params.createdById,
        scopeKey: params.scopeKey,
        type: params.type,
        name: params.name,
        metadata: params.metadata,
        participants: {
          createMany: {
            data: params.participantIds.map((userId) => ({ userId })),
            skipDuplicates: true,
          },
        },
      },
      include: conversationInclude,
    });
  }

  async addParticipants(conversationId: string, participantIds: string[]) {
    if (!participantIds.length) return;

    await this.conversationParticipant.createMany({
      data: participantIds.map((userId) => ({
        conversationId,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  async createMessage(params: CreateMessageParams) {
    return this.message.create({
      data: {
        conversationId: params.conversationId,
        senderId: params.senderId,
        content: params.content,
        type: params.type,
        metadata: params.metadata,
        attachments: params.attachments,
      },
    });
  }

  async updateConversationLastMessage(
    conversationId: string,
    payload: {
      messageId: string;
      messagePreview: string;
      senderId: string;
      sentAt: Date;
    },
  ) {
    await this.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: payload.sentAt,
        lastMessagePreview: payload.messagePreview,
        lastMessageSenderId: payload.senderId,
      },
    });
  }

  async markConversationRead(
    conversationId: string,
    userId: string,
    readAt: Date,
  ) {
    return this.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadAt: readAt,
      },
    });
  }

  async listMessages(
    conversationId: string,
    pagination: {
      skip: number;
      take: number;
      after?: Date;
      before?: Date;
    },
  ) {
    const where: Prisma.MessageWhereInput = {
      conversationId,
      ...(pagination.after && { createdAt: { gt: pagination.after } }),
      ...(pagination.before && { createdAt: { lt: pagination.before } }),
    };

    const [total, data] = await this.$transaction([
      this.message.count({ where: { conversationId } }),
      this.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    return { total, data };
  }

  async countUnreadMessages(
    conversationId: string,
    userId: string,
    lastReadAt?: Date | null,
  ) {
    return this.message.count({
      where: {
        conversationId,
        ...(lastReadAt
          ? {
              createdAt: {
                gt: lastReadAt,
              },
            }
          : {}),
      },
    });
  }

  async getConversationParticipant(conversationId: string, userId: string) {
    return this.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });
  }

  async findClassroomTeacherId(classroomId: string) {
    const classroom = await this.classroom.findUnique({
      where: { id: classroomId },
      select: {
        teacherId: true,
      },
    });
    return classroom?.teacherId ?? null;
  }

  async findClassroomStudentIds(classroomId: string) {
    const students = await this.classroomStudent.findMany({
      where: {
        classroomId,
        isActive: true,
      },
      select: {
        studentId: true,
      },
    });
    return students.map((student) => student.studentId);
  }

  async isStudentInClassroom(classroomId: string, studentId: string) {
    const record = await this.classroomStudent.findUnique({
      where: {
        classroomId_studentId: {
          classroomId,
          studentId,
        },
      },
    });
    return Boolean(record);
  }

  async findClassroomParticipantIds(classroomId: string) {
    const [teacherId, studentIds] = await Promise.all([
      this.findClassroomTeacherId(classroomId),
      this.findClassroomStudentIds(classroomId),
    ]);
    return [teacherId, ...studentIds].filter((id): id is string => Boolean(id));
  }

  async verifyUsersExistence(userIds: string[]) {
    if (!userIds.length) return [] as string[];
    const users = await this.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
      },
    });
    return users.map((u) => u.id);
  }
}
