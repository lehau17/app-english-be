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
import { DeviceToken } from '@prisma/client';
import {
  CreateDeviceTokenDto,
  FilterDeviceTokenRequestDto,
  UpdateDeviceTokenDto,
} from '../dto/device-token.dto';
import { DeviceTokenService } from '../service/device-token.service';

@ApiTags('DeviceTokens')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/device-tokens')
export class PrivateDeviceTokenController {
  constructor(private readonly deviceTokenService: DeviceTokenService) {}

  @Post()
  @ApiOperation({ summary: 'Create a device token' })
  @ResponseMessage('Device token created successfully')
  create(@Body() dto: CreateDeviceTokenDto) {
    return this.deviceTokenService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get device token by id' })
  @ResponseMessage('Device token fetched successfully')
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.deviceTokenService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update device token by id' })
  @ResponseMessage('Device token updated successfully')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDeviceTokenDto,
  ) {
    return this.deviceTokenService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete device token by id' })
  @ResponseMessage('Device token deleted successfully')
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.deviceTokenService.delete(id);
  }

  @Get()
  @ApiOperation({ summary: 'List device tokens (paginated)' })
  @ResponseMessage('Device tokens listed successfully')
  list(
    @Query() query: FilterDeviceTokenRequestDto,
  ): Promise<PageResponseDto<DeviceToken>> {
    return this.deviceTokenService.list(query);
  }
}
