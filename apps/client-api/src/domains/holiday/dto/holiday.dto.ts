import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDate, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class HolidayItemDto {
    @ApiProperty({ example: '2024-01-01', description: 'Date of the holiday (ISO format)' })
    @IsString()
    @IsNotEmpty()
    date: string;

    @ApiProperty({ example: 'New Year', description: 'Name of the holiday' })
    @IsString()
    @IsNotEmpty()
    name: string;
}

export class UpdateYearlyHolidayDto {
    @ApiProperty({ type: [HolidayItemDto], description: 'List of holidays' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HolidayItemDto)
    holidays: HolidayItemDto[];
}
