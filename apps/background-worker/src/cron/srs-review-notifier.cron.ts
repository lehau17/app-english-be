import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaRepository } from '@app/database';
import { KafkaProducerService } from '@app/shared';
import { Status, UserRole } from '@prisma/client';

/**
 * SRS Review Notifier Cron Job
 * Sends notifications to users with skills due for review
 *
 * Runs daily at 9:00 AM
 */
@Injectable()
export class SRSReviewNotifierCron {
  private readonly logger = new Logger(SRSReviewNotifierCron.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  /**
   * Check for skills due for review and send notifications
   * Runs daily at 9:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async notifyDueReviews() {
    this.logger.log('Starting SRS review notification job...');

    try {
      const now = new Date();

      // Find all skills due for review
      const dueSkills = await this.prisma.skillProgress.findMany({
        where: {
          nextReviewAt: {
            lte: now,
          },
        },
        orderBy: {
          nextReviewAt: 'asc',
        },
      });

      if (dueSkills.length === 0) {
        this.logger.log('No skills due for review today');
        return;
      }

      // Group by user
      const userSkillsMap = new Map<
        string,
        Array<{
          skill: string;
          masteryScore: number;
          nextReviewAt: Date;
        }>
      >();

      for (const skillProgress of dueSkills) {
        const userId = skillProgress.userId;

        if (!userSkillsMap.has(userId)) {
          userSkillsMap.set(userId, []);
        }

        userSkillsMap.get(userId)!.push({
          skill: skillProgress.skill,
          masteryScore: skillProgress.masteryScore,
          nextReviewAt: skillProgress.nextReviewAt,
        });
      }

      // Send notifications
      let notificationCount = 0;

      for (const [userId, skills] of userSkillsMap.entries()) {
        // Get user info separately (SkillProgress doesn't have user relation)
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, displayName: true },
        });

        if (!user) continue;

        // Prepare notification data
        const skillList = skills
          .map((s) => `${s.skill} (${s.masteryScore}%)`)
          .join(', ');

        const notificationPayload = {
          userId,
          type: 'SRS_REVIEW_DUE',
          title: 'Time to Review!',
          message: `You have ${skills.length} skill${skills.length > 1 ? 's' : ''} due for review: ${skillList}`,
          data: {
            skills: skills.map((s) => s.skill),
            totalDue: skills.length,
          },
          channels: ['push', 'email'],
        };

        // Send to Kafka notification topic using emit method
        this.kafkaProducer.emit('notifications', notificationPayload, userId);

        notificationCount++;

        this.logger.debug(
          `Sent review notification to user ${userId} for ${skills.length} skills`,
        );
      }

      this.logger.log(
        `Sent ${notificationCount} SRS review notifications to users`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send SRS review notifications: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Generate daily summary report for admins
   * Runs daily at 8:00 AM (before user notifications)
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async generateDailySummary() {
    this.logger.log('Generating SRS daily summary...');

    try {
      const now = new Date();

      // Get counts - using status enum for active users
      const totalUsers = await this.prisma.user.count({
        where: {
          status: Status.active,
          role: UserRole.student,
        },
      });

      const usersWithDueReviews = await this.prisma.skillProgress.groupBy({
        by: ['userId'],
        where: {
          nextReviewAt: {
            lte: now,
          },
        },
      });

      const totalDueSkills = await this.prisma.skillProgress.count({
        where: {
          nextReviewAt: {
            lte: now,
          },
        },
      });

      const averageMastery = await this.prisma.skillProgress.aggregate({
        _avg: {
          masteryScore: true,
        },
      });

      const summary = {
        date: now.toISOString().split('T')[0],
        totalUsers,
        usersWithDueReviews: usersWithDueReviews.length,
        totalDueSkills,
        averageMastery: Math.round(averageMastery._avg.masteryScore || 0),
        reviewRate:
          totalUsers > 0
            ? ((usersWithDueReviews.length / totalUsers) * 100).toFixed(1)
            : 0,
      };

      this.logger.log('SRS Daily Summary:');
      this.logger.log(`   - Total Students: ${summary.totalUsers}`);
      this.logger.log(
        `   - Users with Due Reviews: ${summary.usersWithDueReviews} (${summary.reviewRate}%)`,
      );
      this.logger.log(`   - Total Skills Due: ${summary.totalDueSkills}`);
      this.logger.log(`   - Average Mastery: ${summary.averageMastery}%`);
    } catch (error) {
      this.logger.error(
        `Failed to generate SRS daily summary: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Clean up old review records
   * Runs weekly on Sunday at midnight
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldRecords() {
    this.logger.log('Cleaning up old SRS records...');

    try {
      // Delete skill progress for inactive/banned users
      const inactiveUsers = await this.prisma.user.findMany({
        where: {
          status: {
            in: [Status.inactive, Status.banned],
          },
        },
        select: { id: true },
      });

      const inactiveUserIds = inactiveUsers.map((u) => u.id);

      if (inactiveUserIds.length > 0) {
        const deleted = await this.prisma.skillProgress.deleteMany({
          where: {
            userId: { in: inactiveUserIds },
          },
        });

        this.logger.log(
          `Cleaned up ${deleted.count} skill progress records for inactive users`,
        );
      } else {
        this.logger.log('No skill progress records to clean up');
      }
    } catch (error) {
      this.logger.error(
        `Failed to clean up old SRS records: ${error.message}`,
        error.stack,
      );
    }
  }
}
