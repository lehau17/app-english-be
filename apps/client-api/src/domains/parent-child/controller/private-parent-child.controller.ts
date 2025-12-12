import { PayloadToken, ResponseMessage, Roles, RolesGuard } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ParentChild, UserRole } from '@prisma/client';
import {
  AcceptInvitationCodeDto,
  AcceptInvitationResponseDto,
  CreateParentChildDto,
  FilterParentChildRequestDto,
  GetPendingRequestsDto,
  InvitationResponseDto,
  StudentInviteParentDto,
} from '../dto/parent-child.dto';
import { ParentChildService } from '../service/parent-child.service';

@ApiTags('ParentChildren')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/parent-children')
export class PrivateParentChildController {
  constructor(private readonly parentChildService: ParentChildService) {}

  @Post()
  @ApiOperation({ summary: 'Create a parent-child relationship' })
  @ResponseMessage('Parent-child relationship created successfully')
  create(@Body() dto: CreateParentChildDto) {
    return this.parentChildService.create(dto);
  }

  @Get(':parentId/:childId')
  @ApiOperation({ summary: 'Get parent-child relationship by id' })
  @ResponseMessage('Parent-child relationship fetched successfully')
  findById(
    @Param('parentId', new ParseUUIDPipe()) parentId: string,
    @Param('childId', new ParseUUIDPipe()) childId: string,
  ) {
    return this.parentChildService.findById(parentId, childId);
  }

  @Delete(':parentId/:childId')
  @ApiOperation({ summary: 'Delete parent-child relationship by id' })
  @ResponseMessage('Parent-child relationship deleted successfully')
  delete(
    @Param('parentId', new ParseUUIDPipe()) parentId: string,
    @Param('childId', new ParseUUIDPipe()) childId: string,
  ) {
    return this.parentChildService.delete(parentId, childId);
  }

  @Get()
  @ApiOperation({ summary: 'List parent-child relationships (paginated)' })
  @ResponseMessage('Parent-child relationships listed successfully')
  list(
    @Query() query: FilterParentChildRequestDto,
  ): Promise<PageResponseDto<ParentChild>> {
    return this.parentChildService.list(query);
  }

  // ==================== LINK REQUEST ADMIN ENDPOINTS ====================

  @Get('link-requests/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.teacher)
  @ApiOperation({
    summary: 'Get all pending link requests (Admin/Teacher)',
    description:
      'Admin hoặc Teacher có thể xem danh sách các yêu cầu liên kết đang chờ duyệt',
  })
  @ResponseMessage('Pending link requests fetched successfully')
  getPendingRequests(@Query() query: GetPendingRequestsDto) {
    return this.parentChildService.getPendingRequests(query);
  }

  @Post('link-requests/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.teacher)
  @ApiOperation({
    summary: 'Approve a link request (Admin/Teacher)',
    description:
      'Admin hoặc Teacher duyệt yêu cầu liên kết giữa parent và student',
  })
  @ResponseMessage('Link request approved successfully')
  approveLinkRequest(
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @PayloadToken('sub') adminUserId: string,
  ) {
    return this.parentChildService.approveLinkRequest(requestId, adminUserId);
  }

  @Post('link-requests/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.teacher)
  @ApiOperation({
    summary: 'Reject a link request (Admin/Teacher)',
    description:
      'Admin hoặc Teacher từ chối yêu cầu liên kết giữa parent và student',
  })
  @ResponseMessage('Link request rejected successfully')
  rejectLinkRequest(
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @PayloadToken('sub') adminUserId: string,
  ) {
    return this.parentChildService.rejectLinkRequest(requestId, adminUserId);
  }

  // ==================== STUDENT-INITIATED INVITATION ENDPOINTS ====================

  @Post('student-invite')
  @ApiOperation({
    summary: '[Student] Invite parent via email',
    description:
      'Student sends invitation to parent email. Generates invitation code for sharing.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation created successfully',
    type: InvitationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email or duplicate invitation',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token',
  })
  @ApiResponse({
    status: 409,
    description: 'Parent already linked to student',
  })
  @ResponseMessage('Invitation created successfully')
  async studentInviteParent(
    @PayloadToken('sub') studentId: string,
    @Body() dto: StudentInviteParentDto,
  ): Promise<InvitationResponseDto> {
    const invitation = await this.parentChildService.createStudentInvitation(
      studentId,
      dto.invitedEmail,
    );

    return {
      id: invitation.id,
      invitationCode: invitation.invitationCode,
      invitedEmail: invitation.invitedEmail,
      status: invitation.status,
      initiatedBy: invitation.initiatedBy,
      expiresAt: invitation.expiresAt,
      requestedAt: invitation.requestedAt,
    };
  }

  @Post('accept-code')
  @ApiOperation({
    summary: '[Parent] Accept invitation via code',
    description:
      'Parent enters invitation code. Auto-creates parent-child link if valid.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation accepted successfully',
    type: AcceptInvitationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired invitation code',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Parent already linked to student',
  })
  @ResponseMessage('Invitation accepted successfully')
  async acceptInvitationCode(
    @PayloadToken('sub') parentId: string,
    @Body() dto: AcceptInvitationCodeDto,
  ): Promise<AcceptInvitationResponseDto> {
    const result = await this.parentChildService.acceptInvitationByCode(
      parentId,
      dto.invitationCode,
    );

    return {
      linkRequest: {
        id: result.linkRequest.id,
        invitationCode: result.linkRequest.invitationCode,
        invitedEmail: result.linkRequest.invitedEmail,
        status: result.linkRequest.status,
        initiatedBy: result.linkRequest.initiatedBy,
        expiresAt: result.linkRequest.expiresAt,
        requestedAt: result.linkRequest.requestedAt,
      },
      parentChild: {
        parentId: result.parentChild.parentId,
        childId: result.parentChild.childId,
        linkedAt: result.parentChild.linkedAt,
      },
    };
  }

  @Get('pending-invitations')
  @ApiOperation({
    summary: '[Student] Get pending invitations',
    description: 'Returns list of invitations student sent to parents.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending invitations retrieved successfully',
    type: [InvitationResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token',
  })
  @ResponseMessage('Pending invitations retrieved successfully')
  async getPendingInvitations(
    @PayloadToken('sub') studentId: string,
  ): Promise<InvitationResponseDto[]> {
    const invitations =
      await this.parentChildService.getStudentPendingInvitations(studentId);

    return invitations.map((inv) => ({
      id: inv.id,
      invitationCode: inv.invitationCode,
      invitedEmail: inv.invitedEmail,
      status: inv.status,
      initiatedBy: inv.initiatedBy,
      expiresAt: inv.expiresAt,
      requestedAt: inv.requestedAt,
    }));
  }

  @Delete('invitation/:id')
  @ApiOperation({
    summary: '[Student] Cancel invitation',
    description: 'Student cancels pending invitation before parent accepts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation cancelled successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel non-pending invitation',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token',
  })
  @ApiResponse({
    status: 403,
    description: "Cannot cancel another student's invitation",
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
  @ResponseMessage('Invitation cancelled successfully')
  async cancelInvitation(
    @PayloadToken('sub') studentId: string,
    @Param('id', new ParseUUIDPipe()) invitationId: string,
  ): Promise<{ message: string }> {
    await this.parentChildService.cancelInvitation(invitationId, studentId);

    return { message: 'Invitation cancelled successfully' };
  }
}
