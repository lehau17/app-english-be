import { ResponseMessage } from '@app/shared';
import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateYearlyHolidayDto } from './dto/holiday.dto';
import { HolidayService } from './holiday.service';

@ApiTags('Holidays')
@ApiBearerAuth('Authorization')
@Controller('private/v1/holidays')
export class HolidayController {
    constructor(private readonly holidayService: HolidayService) { }

    @Get(':year')
    @ApiOperation({ summary: 'Get holidays for a specific year' })
    @ResponseMessage('Holidays fetched successfully')
    async getHolidays(@Param('year', ParseIntPipe) year: number) {
        return this.holidayService.getHolidays(year);
    }

    @Put(':year')
    @ApiOperation({ summary: 'Update holidays for a specific year' })
    @ResponseMessage('Holidays updated successfully')
    async updateHolidays(
        @Param('year', ParseIntPipe) year: number,
        @Body() dto: UpdateYearlyHolidayDto,
    ) {
        return this.holidayService.updateHolidays(year, dto);
    }
}
