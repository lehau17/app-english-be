import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    // Get Redis configuration
    const redisHost =
      this.configService.get<string>('REDIS_HOST') || 'localhost';
    const redisPort = this.configService.get<number>('REDIS_PORT') || 6379;
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    const redisDb = this.configService.get<number>('REDIS_DB') || 0;
    const redisUrl = this.configService.get<string>('REDIS_URL');

    // Build Redis configuration
    const redisConfig: any = {
      socket: {
        host: redisHost,
        port: redisPort,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            this.logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection failed');
          }
          return Math.min(retries * 100, 3000);
        },
      },
      database: redisDb,
    };

    // Add password if provided
    if (redisPassword) {
      redisConfig.password = redisPassword;
    }

    // Use URL if provided (overrides individual configs)
    if (redisUrl) {
      redisConfig.url = redisUrl;
      delete redisConfig.socket;
      delete redisConfig.password;
      delete redisConfig.database;
    }

    this.client = createClient(redisConfig);

    this.client.on('error', (err) => {
      this.logger.error(`Redis Client Error: ${err.message}`);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      this.logger.warn(' Redis disconnected');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis ready');
      this.isConnected = true;
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      this.logger.log('Redis service initialized');
    } catch (error) {
      this.logger.error(`Failed to connect to Redis: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    } catch (error) {
      this.logger.error(`Error closing Redis: ${error.message}`);
    }
  }

  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
    if (!this.isConnected) return null;
    try {
      const value = await this.client.get(key);
      return typeof value === 'string' ? value : null;
    } catch (error) {
      this.logger.error(`Redis GET error: ${error.message}`);
      return null;
    }
  }

  /**
   * Set value with optional TTL (seconds)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isConnected) return;
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.error(`Redis SET error: ${error.message}`);
    }
  }

  /**
   * Delete key
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Redis DEL error: ${error.message}`);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS error: ${error.message}`);
      return false;
    }
  }

  /**
   * Set expiration time
   */
  async expire(key: string, seconds: number): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      this.logger.error(`Redis EXPIRE error: ${error.message}`);
    }
  }

  /**
   * List operations
   */
  async lpush(key: string, ...values: string[]): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.lPush(key, values);
    } catch (error) {
      this.logger.error(`Redis LPUSH error: ${error.message}`);
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.isConnected) return [];
    try {
      return await this.client.lRange(key, start, stop);
    } catch (error) {
      this.logger.error(`Redis LRANGE error: ${error.message}`);
      return [];
    }
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.lTrim(key, start, stop);
    } catch (error) {
      this.logger.error(`Redis LTRIM error: ${error.message}`);
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(`Redis INCR error: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get multiple keys
   */
  async mget(...keys: string[]): Promise<(string | {})[]> {
    if (!this.isConnected) return [];
    try {
      return await this.client.mGet(keys);
    } catch (error) {
      this.logger.error(`Redis MGET error: ${error.message}`);
      return [];
    }
  }

  /**
   * Pattern-based key search
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) return [];
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Redis KEYS error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get client for advanced operations
   */
  getClient(): RedisClientType {
    return this.client;
  }

  /**
   * Check connection status
   */
  isReady(): boolean {
    return this.isConnected;
  }
}
