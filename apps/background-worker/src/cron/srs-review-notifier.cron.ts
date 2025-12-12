import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaRepository } from '@app/database';
import { KafkaProducer } from '@app/shared/kafka/kafka.producer';

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
    private readonly kafkaProducer: KafkaProducer,
  ) {}

  /**
   * Check for skills due for review and send notifications
   * Runs daily at 9:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async notifyDueReviews() {
    this.logger.log('🔔 Starting SRS review notification job...');

    try {
      const now = new Date();

      // Find all users with skills due for review
      const dueSkills = await this.prisma.skillProgress.findMany({
        where: {
          nextReviewAt: {
            lte: now,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
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
        const user = dueSkills.find((s) => s.userId === userId)?.user;

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

        // Send to Kafka notification topic
        await this.kafkaProducer.produce('notifications', {
          key: userId,
          value: notificationPayload,
        });

        notificationCount++;

        this.logger.debug(
          `Sent review notification to user ${userId} for ${skills.length} skills`,
        );
      }

      this.logger.log(
        `✅ Sent ${notificationCount} SRS review notifications to users`,
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
    this.logger.log('📊 Generating SRS daily summary...');

    try {
      const now = new Date();

      // Get counts
      const totalUsers = await this.prisma.user.count({
        where: {
          deletedAt: null,
          role: 'STUDENT',
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

      this.logger.log('📊 SRS Daily Summary:');
      this.logger.log(`   - Total Students: ${summary.totalUsers}`);
      this.logger.log(
        `   - Users with Due Reviews: ${summary.usersWithDueReviews} (${summary.reviewRate}%)`,
      );
      this.logger.log(`   - Total Skills Due: ${summary.totalDueSkills}`);
      this.logger.log(`   - Average Mastery: ${summary.averageMastery}%`);

      // Optionally: Send summary to admins via notification
      // await this.sendAdminSummary(summary);
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
    this.logger.log('🧹 Cleaning up old SRS records...');

    try {
      // Delete skill progress for deleted users (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deleted = await this.prisma.skillProgress.deleteMany({
        where: {
          user: {
            deletedAt: {
              lte: thirtyDaysAgo,
            },
          },
        },
      });

      this.logger.log(`🧹 Cleaned up ${deleted.count} old skill progress records`);
    } catch (error) {
      this.logger.error(
        `Failed to clean up old SRS records: ${error.message}`,
        error.stack,
      );
    }
  }
}
