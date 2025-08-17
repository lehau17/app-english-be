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
import { Attempt } from '@prisma/client';
import { CreateAttemptDto, FilterAttemptRequestDto, UpdateAttemptDto } from '../dto/attempt.dto';
import { AttemptService } from '../service/attempt.service';

@ApiTags('Attempts')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/attempts')
export class PrivateAttemptController {
    constructor(private readonly attemptService: AttemptService) { }

    @Post()
    @ApiOperation({ summary: 'Create a attempt' })
    @ResponseMessage('Attempt created successfully')
    create(@Body() dto: CreateAttemptDto) {
        return this.attemptService.create(dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get attempt by id' })
    @ResponseMessage('Attempt fetched successfully')
    findById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.attemptService.findById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update attempt by id' })
    @ResponseMessage('Attempt updated successfully')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateAttemptDto,
    ) {
        return this.attemptService.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete attempt by id' })
    @ResponseMessage('Attempt deleted successfully')
    delete(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.attemptService.delete(id);
    }

    @Get()
    @ApiOperation({ summary: 'List attempts (paginated)' })
    @ResponseMessage('Attempts listed successfully')
    list(@Query() query: FilterAttemptRequestDto): Promise<PageResponseDto<Attempt>> {
        return this.attemptService.list(query);
    }
}
