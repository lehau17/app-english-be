import { SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { HolidayController } from './holiday.controller';
import { HolidayService } from './holiday.service';

@Module({
    imports: [SharedModule],
    controllers: [HolidayController],
    providers: [HolidayService],
    exports: [HolidayService],
})
export class HolidayModule { }
