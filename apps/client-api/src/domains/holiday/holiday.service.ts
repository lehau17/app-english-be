import { PrismaRepository } from '@app/database';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HolidayItemDto, UpdateYearlyHolidayDto } from '../dto/holiday.dto';

@Injectable()
export class HolidayService implements OnModuleInit {
    private readonly logger = new Logger(HolidayService.name);

    // Default Holidays (Fixed dates, Lunar New Year needs manual adjustment usually)
    // For seeding, we adding standard fixed holidays.
    private readonly DEFAULT_HOLIDAYS_TEMPLATE = [
        { date: '01-01', name: 'Tết Dương Lịch' },
        { date: '04-30', name: 'Ngày Giải Phóng Miền Nam' },
        { date: '05-01', name: 'Quốc Tế Lao Động' },
        { date: '09-02', name: 'Quốc Khánh' },
        // Lunar New Year placeholders - admin should update these annually
        // Example for 2024: Feb 10-14 approx
        // Example for 2025: Jan 29 approx
    ];

    constructor(private readonly prisma: PrismaRepository) { }

    async onModuleInit() {
        this.ensureCurrentYearHolidays();
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleCron() {
        this.logger.log('Running holiday seed check...');
        await this.ensureCurrentYearHolidays();
    }

    async ensureCurrentYearHolidays() {
        const currentYear = new Date().getFullYear();
        await this.ensureYearHolidays(currentYear);
        // Also ensure next year for future planning
        await this.ensureYearHolidays(currentYear + 1);
    }

    async ensureYearHolidays(year: number) {
        const exists = await this.prisma.yearlyHoliday.findUnique({
            where: { year },
        });

        if (!exists) {
            this.logger.log(`Seeding holidays for year ${year}`);
            const holidays = this.generateDefaultHolidaysForYear(year);
            await this.prisma.yearlyHoliday.create({
                data: {
                    year,
                    holidays: holidays as any,
                },
            });
        }
    }

    private generateDefaultHolidaysForYear(year: number): HolidayItemDto[] {
        return this.DEFAULT_HOLIDAYS_TEMPLATE.map(h => ({
            date: `${year}-${h.date}`, // Format YYYY-MM-DD
            name: h.name,
        }));
    }

    async getHolidays(year: number) {
        // Ensure exists first
        await this.ensureYearHolidays(year);
        return this.prisma.yearlyHoliday.findUnique({
            where: { year },
        });
    }

    async updateHolidays(year: number, dto: UpdateYearlyHolidayDto) {
        // Ensure exists first (though update technically needs it content)
        await this.ensureYearHolidays(year);

        return this.prisma.yearlyHoliday.update({
            where: { year },
            data: {
                holidays: dto.holidays as any,
            },
        });
    }

    async isHoliday(date: Date): Promise<boolean> {
        const year = date.getFullYear();
        const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD

        const yearlyRecord = await this.prisma.yearlyHoliday.findUnique({
            where: { year },
        });

        if (!yearlyRecord || !Array.isArray(yearlyRecord.holidays)) {
            return false;
        }

        const holidays = yearlyRecord.holidays as unknown as HolidayItemDto[];
        return holidays.some(h => h.date === dateString);
    }
}
