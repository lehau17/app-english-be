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
    Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Notification } from '@prisma/client';
import { CreateNotificationDto, FilterNotificationRequestDto, UpdateNotificationDto } from '../dto/notification.dto';
import { NotificationService } from '../service/notification.service';

@ApiTags('Notifications')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/notifications')
export class PrivateNotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @Post()
    @ApiOperation({ summary: 'Create a notification' })
    @ResponseMessage('Notification created successfully')
    create(@Body() dto: CreateNotificationDto) {
        return this.notificationService.create(dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get notification by id' })
    @ResponseMessage('Notification fetched successfully')
    findById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.notificationService.findById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update notification by id' })
    @ResponseMessage('Notification updated successfully')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateNotificationDto,
    ) {
        return this.notificationService.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete notification by id' })
    @ResponseMessage('Notification deleted successfully')
    delete(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.notificationService.delete(id);
    }

    @Get()
    @ApiOperation({ summary: 'List notifications (paginated)' })
    @ResponseMessage('Notifications listed successfully')
    list(@Query() query: FilterNotificationRequestDto): Promise<PageResponseDto<Notification>> {
        return this.notificationService.list(query);
    }
}
