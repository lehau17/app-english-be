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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParentChild, UserRole } from '@prisma/client';
import {
  CreateParentChildDto,
  FilterParentChildRequestDto,
  GetPendingRequestsDto,
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
}
