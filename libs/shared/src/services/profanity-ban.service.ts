import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface BanStatus {
  isBanned: boolean;
  violationCount: number;
  expiresAt: Date | null;
  remainingSeconds: number;
}

export interface ViolationRecord {
  timestamp: Date;
  text: string;
  severity: string;
}

@Injectable()
export class ProfanityBanService {
  private readonly logger = new Logger(ProfanityBanService.name);
  private readonly MAX_VIOLATIONS = 3;
  private readonly BAN_DURATION_SECONDS = 24 * 60 * 60; // 1 day
  private readonly VIOLATION_WINDOW_SECONDS = 24 * 60 * 60; // 1 day

  constructor(private readonly redis: RedisService) {}

  /**
   * Get Redis key for violation count
   */
  private getViolationKey(userId: string): string {
    const today = new Date().toISOString().split('T')[0];
    return `profanity:violations:${userId}:${today}`;
  }

  /**
   * Get Redis key for ban status
   */
  private getBanKey(userId: string): string {
    return `profanity:ban:${userId}`;
  }

  /**
   * Record a profanity violation
   */
  async recordViolation(
    userId: string,
    text: string,
    severity: string,
  ): Promise<{ violationCount: number; shouldBan: boolean }> {
    const key = this.getViolationKey(userId);

    // Increment violation count
    const count = await this.redis.incr(key);

    // Set expiry on first violation
    if (count === 1) {
      await this.redis.expire(key, this.VIOLATION_WINDOW_SECONDS);
    }

    // Store violation details in a list
    const violationData: ViolationRecord = {
      timestamp: new Date(),
      text: text.substring(0, 100), // Limit text length
      severity,
    };
    await this.redis.lpush(`${key}:details`, JSON.stringify(violationData));
    await this.redis.expire(`${key}:details`, this.VIOLATION_WINDOW_SECONDS);

    this.logger.warn(
      `User ${userId} profanity violation #${count} (severity: ${severity})`,
    );

    const shouldBan = count >= this.MAX_VIOLATIONS;

    if (shouldBan) {
      await this.banUser(userId);
    }

    return { violationCount: count, shouldBan };
  }

  /**
   * Ban a user for the specified duration
   */
  private async banUser(userId: string): Promise<void> {
    const banKey = this.getBanKey(userId);
    const expiresAt = Date.now() + this.BAN_DURATION_SECONDS * 1000;

    await this.redis.set(
      banKey,
      expiresAt.toString(),
      this.BAN_DURATION_SECONDS,
    );

    this.logger.error(
      `User ${userId} BANNED for profanity (expires: ${new Date(expiresAt).toISOString()})`,
    );
  }

  /**
   * Check if user is currently banned
   */
  async checkBanStatus(userId: string): Promise<BanStatus> {
    const banKey = this.getBanKey(userId);
    const violationKey = this.getViolationKey(userId);

    // Check ban status
    const banExpiresAtStr = await this.redis.get(banKey);

    if (banExpiresAtStr) {
      const expiresAt = new Date(parseInt(banExpiresAtStr, 10));
      const remainingSeconds = Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      );

      const violationCount = await this.redis.get(violationKey);

      return {
        isBanned: true,
        violationCount: parseInt(violationCount || '0', 10),
        expiresAt,
        remainingSeconds,
      };
    }

    // Not banned, check violation count
    const violationCount = await this.redis.get(violationKey);

    return {
      isBanned: false,
      violationCount: parseInt(violationCount || '0', 10),
      expiresAt: null,
      remainingSeconds: 0,
    };
  }

  /**
   * Get violation history for a user
   */
  async getViolationHistory(userId: string): Promise<ViolationRecord[]> {
    const key = `${this.getViolationKey(userId)}:details`;
    const records = await this.redis.lrange(key, 0, -1);

    return records.map((record) => JSON.parse(record) as ViolationRecord);
  }

  /**
   * Manually unban a user (admin function)
   */
  async unbanUser(userId: string): Promise<void> {
    const banKey = this.getBanKey(userId);
    await this.redis.del(banKey);
    this.logger.log(`User ${userId} manually unbanned`);
  }

  /**
   * Format remaining time as human-readable string
   */
  formatRemainingTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} giờ ${minutes} phút`;
    }
    return `${minutes} phút`;
  }
}
