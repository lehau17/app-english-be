import { ResponseMessage } from '@app/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AssignParentDto,
  CreateParentDto,
  ParentListQueryDto,
  UpdateParentDto,
} from '../dto';
import { AdminParentService } from '../service';

@ApiTags('Admin - Parents')
@ApiBearerAuth()
@Controller('/private/v1/admin/parents')
export class AdminParentController {
  constructor(private readonly adminParentService: AdminParentService) {}

  @Get()
  @ApiOperation({ summary: 'Get parents list with pagination and search' })
  @ResponseMessage('Parents list fetched successfully')
  getParents(@Query() query: ParentListQueryDto) {
    return this.adminParentService.getParents(query);
  }

  @Get('available-students')
  @ApiOperation({ summary: 'Get students available for parent assignment' })
  @ResponseMessage('Available students fetched successfully')
  getAvailableStudents(@Query('search') search?: string) {
    return this.adminParentService.getAvailableStudents(search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get parent details by ID' })
  @ResponseMessage('Parent details fetched successfully')
  getParentById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminParentService.getParentById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new parent account' })
  @ResponseMessage('Parent created successfully')
  createParent(@Body() dto: CreateParentDto) {
    return this.adminParentService.createParent(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update parent information' })
  @ResponseMessage('Parent updated successfully')
  updateParent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateParentDto,
  ) {
    return this.adminParentService.updateParent(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete parent account' })
  @ResponseMessage('Parent deleted successfully')
  deleteParent(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminParentService.deleteParent(id);
  }

  @Post(':parentId/assign-children')
  @ApiOperation({ summary: 'Assign children to parent' })
  @ResponseMessage('Children assigned to parent successfully')
  assignChildren(
    @Param('parentId', new ParseUUIDPipe()) parentId: string,
    @Body() dto: AssignParentDto,
  ) {
    return this.adminParentService.assignChildren(parentId, dto);
  }

  @Get(':parentId/children')
  @ApiOperation({ summary: 'Get children assigned to a parent' })
  @ResponseMessage('Parent children fetched successfully')
  getParentChildren(@Param('parentId', new ParseUUIDPipe()) parentId: string) {
    return this.adminParentService.getParentChildren(parentId);
  }

  @Delete(':parentId/children/:childId')
  @ApiOperation({ summary: 'Remove child from parent' })
  @ResponseMessage('Child removed from parent successfully')
  removeChildFromParent(
    @Param('parentId', new ParseUUIDPipe()) parentId: string,
    @Param('childId', new ParseUUIDPipe()) childId: string,
  ) {
    return this.adminParentService.removeChildFromParent(parentId, childId);
  }

  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Toggle parent account active status' })
  @ResponseMessage('Parent status toggled successfully')
  toggleParentStatus(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminParentService.toggleParentStatus(id);
  }
}
