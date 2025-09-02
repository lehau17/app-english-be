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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Activity } from '@prisma/client';
import {
  CreateActivityDto,
  FilterActivityRequestDto,
  UpdateActivityDto,
} from '../dto/activity.dto';
import { ActivityService } from '../service/activity.service';

@ApiTags('Activities')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/activities')
export class PrivateActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post()
  @ApiOperation({ summary: 'Create a activity' })
  @ResponseMessage('Activity created successfully')
  create(@Body() dto: CreateActivityDto) {
    return this.activityService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get activity by id' })
  @ResponseMessage('Activity fetched successfully')
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.activityService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update activity by id' })
  @ResponseMessage('Activity updated successfully')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activityService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete activity by id' })
  @ResponseMessage('Activity deleted successfully')
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.activityService.delete(id);
  }

  @Get()
  @ApiOperation({ summary: 'List activities (paginated)' })
  @ResponseMessage('Activities listed successfully')
  list(
    @Query() query: FilterActivityRequestDto,
  ): Promise<PageResponseDto<Activity>> {
    return this.activityService.list(query);
  }
}
