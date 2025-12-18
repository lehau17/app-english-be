import { Body, Controller, Get, Param, Post, Put, OnModuleInit } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@app/shared';
import { CreateSystemSettingDto, UpdateSystemSettingDto } from './dto/system-setting.dto';
import { SystemSettingService } from './system-setting.service';

@ApiTags('System Settings')
@Controller('system-settings')
export class SystemSettingController implements OnModuleInit {
    constructor(private readonly service: SystemSettingService) { }

    async onModuleInit() {
        await this.service.initializeDefaults();
    }

    @Get()
    async findAll() {
        return this.service.findAll();
    }

    @Public()
    @Get('public')
    async findPublic() {
        return this.service.findPublicSettings();
    }

    @Get(':key')
    async findOne(@Param('key') key: string) {
        return this.service.findByKey(key);
    }

    @Post()
    async create(@Body() dto: CreateSystemSettingDto) {
        return this.service.create(dto);
    }

    @Put(':key')
    async update(@Param('key') key: string, @Body() dto: UpdateSystemSettingDto) {
        return this.service.update(key, dto);
    }
}
