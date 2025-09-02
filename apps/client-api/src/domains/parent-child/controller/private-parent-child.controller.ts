import { ResponseMessage } from '@app/shared';
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParentChild } from '@prisma/client';
import {
  CreateParentChildDto,
  FilterParentChildRequestDto,
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
}
