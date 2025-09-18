import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestPagingDto } from '@app/shared/payload/request/request-paging.dto';
import { ConversationType, MessageType, UserRole } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class ConversationParticipantDto {
  @ApiProperty({ description: 'Participant user id' })
  id!: string;

  @ApiPropertyOptional({ description: 'Display name of the participant' })
  displayName?: string | null;

  @ApiPropertyOptional({ description: 'First name of the participant' })
  firstName?: string | null;

  @ApiPropertyOptional({ description: 'Last name of the participant' })
  lastName?: string | null;

  @ApiProperty({ enum: UserRole, description: 'Role of the participant' })
  role!: UserRole;

  @ApiPropertyOptional({ description: 'Avatar URL for the participant' })
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Whether the conversation is pinned for this participant',
  })
  isPinned?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the conversation is muted for this participant',
  })
  isMuted?: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp when this participant last read the conversation',
    type: String,
    format: 'date-time',
  })
  lastReadAt?: Date | null;
}

export class ConversationSummaryDto {
  @ApiProperty({ description: 'Conversation id' })
  id!: string;

  @ApiProperty({ description: 'Classroom id this conversation belongs to' })
  classroomId!: string;

  @ApiProperty({ enum: ConversationType, description: 'Conversation type' })
  type!: ConversationType;

  @ApiPropertyOptional({ description: 'Custom conversation name' })
  name?: string | null;

  @ApiProperty({ description: 'Conversation scope key used for uniqueness' })
  scopeKey!: string;

  @ApiPropertyOptional({
    description: 'Timestamp of the last message',
    type: String,
    format: 'date-time',
  })
  lastMessageAt?: Date | null;

  @ApiPropertyOptional({ description: 'Preview content of the last message' })
  lastMessagePreview?: string | null;

  @ApiPropertyOptional({ description: 'Identifier of the last message sender' })
  lastMessageSenderId?: string | null;

  @ApiPropertyOptional({
    description: 'Additional metadata stored on the conversation',
    type: Object,
  })
  metadata?: Record<string, any> | null;

  @ApiPropertyOptional({
    description: 'Total number of messages in the conversation',
    example: 0,
  })
  messageCount?: number;

  @ApiPropertyOptional({
    description: 'Number of unread messages for the current user',
    example: 0,
  })
  unreadCount?: number;

  @ApiProperty({
    type: () => [ConversationParticipantDto],
    description: 'Participants of the conversation',
  })
  participants!: ConversationParticipantDto[];
}

export class ConversationMessageDto {
  @ApiProperty({ description: 'Message id' })
  id!: string;

  @ApiProperty({ description: 'Conversation id' })
  conversationId!: string;

  @ApiProperty({ description: 'Sender id' })
  senderId!: string;

  @ApiProperty({ description: 'Textual content of the message' })
  content!: string;

  @ApiProperty({ enum: MessageType, description: 'Message type' })
  type!: MessageType;

  @ApiPropertyOptional({
    description: 'Structured metadata attached to the message',
    type: Object,
  })
  metadata?: Record<string, any> | null;

  @ApiPropertyOptional({
    description: 'Attachments payload for the message',
    type: Object,
  })
  attachments?: Record<string, any> | null;

  @ApiProperty({
    description: 'Whether the message was edited',
    example: false,
  })
  isEdited!: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp of the last edit',
    type: String,
    format: 'date-time',
  })
  editedAt?: Date | null;

  @ApiProperty({
    description: 'Creation timestamp',
    type: String,
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Update timestamp',
    type: String,
    format: 'date-time',
  })
  updatedAt!: Date;
}

export class CreateConversationDto {
  @ApiProperty({
    enum: ConversationType,
    description: 'Type of conversation to create',
  })
  @IsEnum(ConversationType)
  type!: ConversationType;

  @ApiPropertyOptional({
    description: 'Optional readable name for the conversation',
    minLength: 1,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Participant identifiers to include for personal conversations',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];

  @ApiPropertyOptional({
    description: 'Optional metadata payload stored with the conversation',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ConversationListQueryDto extends RequestPagingDto {
  @ApiPropertyOptional({
    enum: ConversationType,
    description: 'Filter by conversation type',
  })
  @IsOptional()
  @IsEnum(ConversationType)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  type?: ConversationType;
}

export class ConversationMessageQueryDto extends RequestPagingDto {
  @ApiPropertyOptional({
    description: 'Return messages created before this ISO timestamp',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsString()
  before?: string;

  @ApiPropertyOptional({
    description: 'Return messages created after this ISO timestamp',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsString()
  after?: string;
}

export class SendMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({
    enum: MessageType,
    description: 'Message type',
    default: MessageType.text,
  })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType = MessageType.text;

  @ApiPropertyOptional({
    description: 'Structured metadata for the message',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Attachments payload for the message',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  attachments?: Record<string, any>;
}

export class MarkConversationReadDto {
  @ApiPropertyOptional({
    description: 'Read timestamp override. Defaults to now()',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsString()
  readAt?: string;
}

export class ConversationMessagesResponseDto {
  @ApiProperty({
    type: () => [ConversationMessageDto],
    description: 'Messages returned for the selected page',
  })
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageDto)
  data!: ConversationMessageDto[];

  @ApiProperty({ description: 'Current page index', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Page size', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Total messages count', example: 42 })
  totalItems!: number;

  @ApiProperty({ description: 'Total number of pages', example: 3 })
  totalPages!: number;

  @ApiProperty({ description: 'Whether there is a next page', example: false })
  hasNextPage!: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPrevPage!: boolean;
}
