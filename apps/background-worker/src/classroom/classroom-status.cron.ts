import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClassroomService } from '../../../client-api/src/domains/classroom/service/classroom.service';

/**
 * Cron job to automatically update classroom statuses based on dates
 * Runs daily at 00:01 AM Asia/Ho_Chi_Minh timezone
 */
@Injectable()
export class ClassroomStatusCron {
  private readonly logger = new Logger(ClassroomStatusCron.name);

  constructor(private readonly classroomService: ClassroomService) {}

  /**
   * Auto-update classroom statuses daily
   * - UPCOMING → ONGOING: when periodStart <= now < periodEnd
   * - ONGOING → COMPLETED: when periodEnd <= now
   */
  @Cron('1 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async updateClassroomStatuses(): Promise<void> {
    try {
      this.logger.log('🔄 Starting auto-update classroom statuses...');

      const result = await this.classroomService.autoUpdateClassroomStatuses();

      this.logger.log(
        `✅ Classroom statuses updated successfully: ${result.activatedCount} activated, ${result.completedCount} completed`,
      );
    } catch (error) {
      this.logger.error('❌ Failed to auto-update classroom statuses', error);
    }
  }
}
