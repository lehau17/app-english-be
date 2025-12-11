import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Rate Limiting Guard using Redis
 * Limits requests per IP address
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private redis: Redis | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initRedis();
  }

  private async initRedis(): Promise<void> {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    const redisDb = this.configService.get<number>('REDIS_DB', 0);

    try {
      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword || undefined,
        db: redisDb,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      await this.redis.connect();
      this.redis.on('error', (err) => {
        this.logger.error(`Redis error in RateLimitGuard: ${err.message}`);
      });
    } catch (error) {
      this.logger.warn(
        `Failed to connect to Redis for rate limiting: ${(error as Error).message}. Rate limiting disabled.`,
      );
      this.redis = null;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // If Redis is not available, allow the request (fail open)
    if (!this.redis) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ip = this.getClientIp(request);

    // Rate limit configuration
    const windowSeconds = 60; // 1 minute window
    const maxRequests = 100; // 100 requests per window for share view
    const maxDownloads = 10; // 10 downloads per window

    const path = request.path || request.url || '';
    const isDownload = path.includes('/download');

    const limit = isDownload ? maxDownloads : maxRequests;
    const key = `ratelimit:certificate:${isDownload ? 'download' : 'view'}:${ip}`;

    try {
      const current = await this.redis.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await this.redis.expire(key, windowSeconds);
      }

      if (current > limit) {
        this.logger.warn(
          `Rate limit exceeded for IP ${ip} on ${isDownload ? 'download' : 'view'} endpoint`,
        );
        throw new HttpException(
          `Too many requests. Please try again in ${windowSeconds} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      // If Redis error, log and allow request (fail open)
      this.logger.error(
        `Rate limit check failed: ${(error as Error).message}. Allowing request.`,
      );
      return true;
    }
  }

  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }
}
