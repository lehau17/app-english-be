import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ConversationListQueryDto,
  ConversationMessageQueryDto,
  ConversationMessagesResponseDto,
  ConversationSummaryDto,
  CreateConversationDto,
  MarkConversationReadDto,
  SendMessageDto,
} from '../dto/conversation.dto';
import { ConversationService } from '../service/conversation.service';

@ApiTags('Conversation')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/classrooms/:classroomId/conversations')
export class PrivateConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  @ApiOperation({ summary: 'List conversations for a classroom' })
  @ResponseMessage('Conversations fetched successfully')
  listConversations(
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
    @PayloadToken() payload: JwtPayload,
    @Query() query: ConversationListQueryDto,
  ): Promise<PageResponseDto<ConversationSummaryDto>> {
    return this.conversationService.listConversations(
      classroomId,
      payload.sub,
      query,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new conversation or return existing one' })
  @ResponseMessage('Conversation created successfully')
  createConversation(
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
    @PayloadToken() payload: JwtPayload,
    @Body() body: CreateConversationDto,
  ) {
    return this.conversationService.createConversation(
      classroomId,
      payload.sub,
      body,
    );
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'Get conversation detail' })
  @ResponseMessage('Conversation fetched successfully')
  getConversation(
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.conversationService.getConversationDetail(
      classroomId,
      conversationId,
      payload.sub,
    );
  }

  @Get(':conversationId/messages')
  @ApiOperation({ summary: 'List messages within a conversation' })
  @ResponseMessage('Conversation messages fetched successfully')
  listMessages(
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @PayloadToken() payload: JwtPayload,
    @Query() query: ConversationMessageQueryDto,
  ): Promise<ConversationMessagesResponseDto> {
    return this.conversationService.listMessages(
      classroomId,
      conversationId,
      payload.sub,
      query,
    );
  }

  @Post(':conversationId/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  @ResponseMessage('Message sent successfully')
  sendMessage(
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @PayloadToken() payload: JwtPayload,
    @Body() body: SendMessageDto,
  ) {
    return this.conversationService.sendMessage(
      classroomId,
      conversationId,
      payload.sub,
      body,
    );
  }

  @Post(':conversationId/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  @ResponseMessage('Conversation marked as read successfully')
  markAsRead(
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @PayloadToken() payload: JwtPayload,
    @Body() body: MarkConversationReadDto,
  ) {
    return this.conversationService.markConversationRead(
      classroomId,
      conversationId,
      payload.sub,
      body,
    );
  }
}
