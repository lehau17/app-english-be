import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { EventsGateway } from '../../../events/events.gateway';
import { ConversationType, Message, MessageType } from '@prisma/client';
import {
  ConversationListQueryDto,
  ConversationMessageDto,
  ConversationMessageQueryDto,
  ConversationMessagesResponseDto,
  ConversationParticipantDto,
  ConversationSummaryDto,
  CreateConversationDto,
  MarkConversationReadDto,
  SendMessageDto,
} from '../dto/conversation.dto';
import {
  ConversationRepository,
  ConversationWithRelations,
} from '../repository/conversation.repository';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

const CONVERSATION_MESSAGE_EVENT = 'conversation.message';
const CONVERSATION_UPDATED_EVENT = 'conversation.updated';

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async listConversations(
    classroomId: string,
    userId: string,
    query: ConversationListQueryDto,
  ) {
    await this.ensureUserInClassroom(classroomId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { total, conversations } =
      await this.conversationRepository.listConversations({
        classroomId,
        userId,
        type: query.type,
        skip,
        take: limit,
      });

    const conversationDtos = await Promise.all(
      conversations.map(async (conversation) => {
        const participant = conversation.participants.find(
          (item) => item.userId === userId,
        );
        const unreadCount =
          await this.conversationRepository.countUnreadMessages(
            conversation.id,
            userId,
            participant?.lastReadAt,
          );

        return this.mapConversationToDto(conversation, unreadCount);
      }),
    );

    return PageResponseDto.of(conversationDtos, page, limit, total);
  }

  async createConversation(
    classroomId: string,
    userId: string,
    dto: CreateConversationDto,
  ) {
    await this.ensureUserInClassroom(classroomId, userId);

    if (dto.type === ConversationType.class) {
      return this.createClassConversation(classroomId, userId, dto);
    }

    return this.createPersonalConversation(classroomId, userId, dto);
  }

  async getConversationDetail(
    classroomId: string,
    conversationId: string,
    userId: string,
  ) {
    await this.ensureUserInClassroom(classroomId, userId);

    const conversation =
      await this.conversationRepository.findConversationForUser(
        conversationId,
        userId,
      );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const participant = conversation.participants.find(
      (item) => item.userId === userId,
    );

    const unreadCount = await this.conversationRepository.countUnreadMessages(
      conversation.id,
      userId,
      participant?.lastReadAt,
    );

    return this.mapConversationToDto(conversation, unreadCount);
  }

  async listMessages(
    classroomId: string,
    conversationId: string,
    userId: string,
    query: ConversationMessageQueryDto,
  ): Promise<ConversationMessagesResponseDto> {
    await this.ensureUserInClassroom(classroomId, userId);

    const conversation =
      await this.conversationRepository.findConversationForUser(
        conversationId,
        userId,
      );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const after = query.after ? this.parseDate(query.after) : undefined;
    const before = query.before ? this.parseDate(query.before) : undefined;

    const { data, total } = await this.conversationRepository.listMessages(
      conversationId,
      {
        skip,
        take: limit,
        after,
        before,
      },
    );

    const orderedData = query.sortOrder === 'asc' ? data.reverse() : data;

    return {
      data: orderedData.map((message) => this.mapMessageToDto(message)),
      page,
      limit,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    };
  }

  async sendMessage(
    classroomId: string,
    conversationId: string,
    userId: string,
    dto: SendMessageDto,
  ) {
    await this.ensureUserInClassroom(classroomId, userId);

    const conversation =
      await this.conversationRepository.findConversationForUser(
        conversationId,
        userId,
      );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const messageType = dto.type ?? MessageType.text;
    const message = await this.conversationRepository.createMessage({
      conversationId,
      senderId: userId,
      content: dto.content,
      type: messageType,
      metadata: dto.metadata,
      attachments: dto.attachments,
    });

    await this.conversationRepository.updateConversationLastMessage(
      conversationId,
      {
        messageId: message.id,
        messagePreview: dto.content.slice(0, 200),
        senderId: userId,
        sentAt: message.createdAt,
      },
    );

    await this.conversationRepository.markConversationRead(
      conversationId,
      userId,
      message.createdAt,
    );

    const updatedConversation =
      await this.conversationRepository.findConversationForUser(
        conversationId,
        userId,
      );

    if (!updatedConversation) {
      throw new NotFoundException(
        'Conversation not found after sending message',
      );
    }

    const participant = updatedConversation.participants.find(
      (item) => item.userId === userId,
    );

    const unreadCount = await this.conversationRepository.countUnreadMessages(
      updatedConversation.id,
      userId,
      participant?.lastReadAt,
    );

    const conversationDto = this.mapConversationToDto(
      updatedConversation,
      unreadCount,
    );

    const messageDto = this.mapMessageToDto(message);

    for (const participantEntry of updatedConversation.participants) {
      this.eventsGateway.emitToUser(
        participantEntry.userId,
        CONVERSATION_MESSAGE_EVENT,
        {
          conversation: conversationDto,
          message: messageDto,
        },
      );

      this.eventsGateway.emitToUser(
        participantEntry.userId,
        CONVERSATION_UPDATED_EVENT,
        conversationDto,
      );
    }

    return { conversation: conversationDto, message: messageDto };
  }

  async markConversationRead(
    classroomId: string,
    conversationId: string,
    userId: string,
    dto: MarkConversationReadDto,
  ) {
    await this.ensureUserInClassroom(classroomId, userId);

    const conversation =
      await this.conversationRepository.findConversationForUser(
        conversationId,
        userId,
      );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const readAt = dto.readAt ? this.parseDate(dto.readAt) : new Date();

    await this.conversationRepository.markConversationRead(
      conversationId,
      userId,
      readAt,
    );

    const unreadCount = await this.conversationRepository.countUnreadMessages(
      conversationId,
      userId,
      readAt,
    );

    return this.mapConversationToDto(conversation, unreadCount);
  }

  private async createClassConversation(
    classroomId: string,
    userId: string,
    dto: CreateConversationDto,
  ) {
    const scopeKey = `classroom:${classroomId}:class`;

    const participantIds =
      await this.conversationRepository.findClassroomParticipantIds(
        classroomId,
      );

    if (!participantIds.includes(userId)) {
      participantIds.push(userId);
    }

    const existing =
      await this.conversationRepository.findConversationByScope(scopeKey);

    if (existing) {
      await this.conversationRepository.addParticipants(
        existing.id,
        participantIds,
      );

      const participant = existing.participants.find(
        (item) => item.userId === userId,
      );
      const unreadCount = await this.conversationRepository.countUnreadMessages(
        existing.id,
        userId,
        participant?.lastReadAt,
      );
      return this.mapConversationToDto(existing, unreadCount);
    }

    const conversation = await this.conversationRepository.createConversation({
      classroomId,
      createdById: userId,
      scopeKey,
      type: ConversationType.class,
      name: dto.name ?? 'Classroom conversation',
      metadata: dto.metadata,
      participantIds,
    });

    const unreadCount = 0;
    return this.mapConversationToDto(conversation, unreadCount);
  }

  private async createPersonalConversation(
    classroomId: string,
    userId: string,
    dto: CreateConversationDto,
  ) {
    if (!dto.participantIds || dto.participantIds.length === 0) {
      throw new BadRequestException(
        'participantIds is required for personal conversations',
      );
    }

    const distinctParticipantIds = Array.from(
      new Set(dto.participantIds.filter(Boolean)),
    );

    if (distinctParticipantIds.includes(userId)) {
      throw new BadRequestException(
        'participantIds should not include the creator',
      );
    }

    if (distinctParticipantIds.length !== 1) {
      throw new BadRequestException(
        'Personal conversations currently support exactly one target participant',
      );
    }

    const [teacherId, isStudentInClassroom] = await Promise.all([
      this.conversationRepository.findClassroomTeacherId(classroomId),
      this.conversationRepository.isStudentInClassroom(
        classroomId,
        distinctParticipantIds[0],
      ),
    ]);

    const isCreatorTeacher = teacherId === userId;
    const isTargetTeacher = teacherId === distinctParticipantIds[0];

    if (!isCreatorTeacher && !isTargetTeacher && !isStudentInClassroom) {
      throw new ForbiddenException('Target user must be part of the classroom');
    }

    if (!isTargetTeacher && !isStudentInClassroom) {
      throw new ForbiddenException(
        'Target user must be an active student of the classroom',
      );
    }

    const memberIds = [userId, ...distinctParticipantIds].sort();
    const scopeKey = `classroom:${classroomId}:personal:${memberIds.join(':')}`;

    const existing =
      await this.conversationRepository.findConversationByScope(scopeKey);

    if (existing) {
      const participant = existing.participants.find(
        (item) => item.userId === userId,
      );
      const unreadCount = await this.conversationRepository.countUnreadMessages(
        existing.id,
        userId,
        participant?.lastReadAt,
      );
      return this.mapConversationToDto(existing, unreadCount);
    }

    const conversation = await this.conversationRepository.createConversation({
      classroomId,
      createdById: userId,
      scopeKey,
      type: ConversationType.personal,
      name: dto.name,
      metadata: dto.metadata,
      participantIds: memberIds,
    });

    const unreadCount = 0;
    return this.mapConversationToDto(conversation, unreadCount);
  }

  private async ensureUserInClassroom(classroomId: string, userId: string) {
    const [teacherId, isStudent] = await Promise.all([
      this.conversationRepository.findClassroomTeacherId(classroomId),
      this.conversationRepository.isStudentInClassroom(classroomId, userId),
    ]);

    if (teacherId !== userId && !isStudent) {
      throw new ForbiddenException('You are not part of this classroom');
    }
  }

  private mapConversationToDto(
    conversation: ConversationWithRelations,
    unreadCount: number,
  ): ConversationSummaryDto {
    const participants = conversation.participants.map((participant) =>
      this.mapParticipantToDto(participant),
    );

    return {
      id: conversation.id,
      classroomId: conversation.classroomId,
      type: conversation.type,
      name: conversation.name,
      scopeKey: conversation.scopeKey,
      lastMessageAt: conversation.lastMessageAt ?? null,
      lastMessagePreview: conversation.lastMessagePreview ?? null,
      lastMessageSenderId: conversation.lastMessageSenderId ?? null,
      metadata: (conversation.metadata as Record<string, any> | null) ?? null,
      messageCount: conversation._count?.messages ?? 0,
      unreadCount,
      participants,
    };
  }

  private mapParticipantToDto(
    participant: ConversationWithRelations['participants'][number],
  ): ConversationParticipantDto {
    return {
      id: participant.user.id,
      displayName: participant.user.displayName,
      firstName: participant.user.firstName,
      lastName: participant.user.lastName,
      role: participant.user.role,
      avatarUrl: participant.user.avatarUrl,
      isPinned: participant.isPinned,
      isMuted: participant.isMuted,
      lastReadAt: participant.lastReadAt,
    };
  }

  private mapMessageToDto(message: Message): ConversationMessageDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      type: message.type,
      metadata: (message.metadata as Record<string, any> | null) ?? null,
      attachments: (message.attachments as Record<string, any> | null) ?? null,
      isEdited: message.isEdited,
      editedAt: message.editedAt ?? null,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private parseDate(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    return parsed;
  }
}
