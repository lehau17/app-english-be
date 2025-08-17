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
import { Progress } from '@prisma/client';
import { CreateProgressDto, FilterProgressRequestDto, UpdateProgressDto } from '../dto/progress.dto';
import { ProgressService } from '../service/progress.service';

@ApiTags('Progresses')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/progresses')
export class PrivateProgressController {
    constructor(private readonly progressService: ProgressService) { }

    @Post()
    @ApiOperation({ summary: 'Create a progress' })
    @ResponseMessage('Progress created successfully')
    create(@Body() dto: CreateProgressDto) {
        return this.progressService.create(dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get progress by id' })
    @ResponseMessage('Progress fetched successfully')
    findById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.progressService.findById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update progress by id' })
    @ResponseMessage('Progress updated successfully')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateProgressDto,
    ) {
        return this.progressService.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete progress by id' })
    @ResponseMessage('Progress deleted successfully')
    delete(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.progressService.delete(id);
    }

    @Get()
    @ApiOperation({ summary: 'List progresses (paginated)' })
    @ResponseMessage('Progresses listed successfully')
    list(@Query() query: FilterProgressRequestDto): Promise<PageResponseDto<Progress>> {
        return this.progressService.list(query);
    }
}
