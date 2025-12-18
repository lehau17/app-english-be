import { Module } from '@nestjs/common';
import { SystemSettingController } from './system-setting.controller';
import { SystemSettingService } from './system-setting.service';

@Module({
    controllers: [SystemSettingController],
    providers: [SystemSettingService],
    exports: [SystemSettingService],
})
export class SystemSettingModule { }
