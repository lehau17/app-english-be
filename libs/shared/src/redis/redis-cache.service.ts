import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { CACHE_TTL, LOCK_CONFIG } from './cache-keys.constants';

/**
 * Redis Cache Service with Version Control & Distributed Locking
 *
 * Features:
 * - Version-based cache invalidation (no need to delete old cache)
 * - TRUE Distributed locking: Only 1 request hits DB, all others WAIT for cache
 * - Automatic TTL management
 * - Type-safe cache operations
 *
 * Cache Strategy:
 * - Each cache key includes a version: `cache:{prefix}:v{version}:{key}`
 * - When data changes, increment version → old cache expires naturally
 * - Default TTL: 60 seconds
 *
 * Locking Strategy:
 * - Lock TTL: 10 seconds (auto-release if process crashes)
 * - Max retries: 100 times with 50ms delay
 * - On cache miss: acquire lock → ONLY winner fetches from DB → losers WAIT then get from cache
 * - Lock is ALWAYS released in finally block (immediate unlock after DB fetch)
 */
@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private redis: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
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
        this.logger.error(`Redis error: ${err.message}`);
      });

      this.redis.on('connect', () => {
        this.logger.log('Redis Cache Service connected');
      });

      // Test connection
      await this.redis.ping();
      this.logger.log('Redis Cache Service initialized');
    } catch (error) {
      this.logger.error(
        `Failed to connect to Redis: ${(error as Error).message}`,
      );
      this.logger.warn('Cache operations will be no-op');
      this.redis = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    }
  }

  // ==================== VERSION MANAGEMENT ====================

  /**
   * Get current version for a cache prefix
   */
  async getVersion(prefix: string): Promise<number> {
    if (!this.redis) return 1;

    try {
      const version = await this.redis.get(`version:${prefix}`);
      return version ? parseInt(version, 10) : 1;
    } catch (error) {
      this.logger.error(`Error getting version: ${(error as Error).message}`);
      return 1;
    }
  }

  /**
   * Increment version for a cache prefix (invalidates all cache for that prefix)
   */
  async incrementVersion(prefix: string): Promise<number> {
    if (!this.redis) return 1;

    try {
      const newVersion = await this.redis.incr(`version:${prefix}`);
      this.logger.debug(`Version incremented: ${prefix} → v${newVersion}`);
      return newVersion;
    } catch (error) {
      this.logger.error(
        `Error incrementing version: ${(error as Error).message}`,
      );
      return 1;
    }
  }

  // ==================== CACHE KEY BUILDING ====================

  /**
   * Build cache key with version
   */
  private async buildCacheKey(prefix: string, key: string): Promise<string> {
    const version = await this.getVersion(prefix);
    return `cache:${prefix}:v${version}:${key}`;
  }

  /**
   * Build lock key
   */
  private buildLockKey(prefix: string, key: string): string {
    return `lock:${prefix}:${key}`;
  }

  // ==================== DISTRIBUTED LOCK ====================

  /**
   * Acquire distributed lock
   * @returns Lock ID if acquired, null otherwise
   */
  private async acquireLock(lockKey: string): Promise<string | null> {
    if (!this.redis) return uuidv4(); // Fake lock if Redis unavailable

    const lockId = uuidv4();

    for (let attempt = 0; attempt < LOCK_CONFIG.MAX_RETRIES; attempt++) {
      try {
        // SET NX EX - Set if Not eXists with EXpiration (10s)
        const result = await this.redis.set(
          lockKey,
          lockId,
          'EX',
          LOCK_CONFIG.TTL,
          'NX',
        );

        if (result === 'OK') {
          this.logger.debug(
            `Lock acquired: ${lockKey} (attempt ${attempt + 1})`,
          );
          return lockId;
        }

        // Lock exists, wait and retry
        if (attempt < LOCK_CONFIG.MAX_RETRIES - 1) {
          await this.sleep(LOCK_CONFIG.RETRY_DELAY);
        }
      } catch (error) {
        this.logger.error(`Lock error: ${(error as Error).message}`);
        throw error;
      }
    }

    this.logger.warn(
      `Failed to acquire lock after ${LOCK_CONFIG.MAX_RETRIES} attempts: ${lockKey}`,
    );
    return null;
  }

  /**
   * Release distributed lock (atomic check and delete via Lua script)
   */
  private async releaseLock(lockKey: string, lockId: string): Promise<boolean> {
    if (!this.redis) return true;

    try {
      // Lua script: only delete if lockId matches (atomic operation)
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(luaScript, 1, lockKey, lockId);

      if (result === 1) {
        this.logger.debug(`🔓 Lock released: ${lockKey}`);
        return true;
      }

      this.logger.warn(`Lock release failed (expired or stolen): ${lockKey}`);
      return false;
    } catch (error) {
      this.logger.error(`Unlock error: ${(error as Error).message}`);
      return false;
    }
  }

  // ==================== BASIC CACHE OPERATIONS ====================

  /**
   * Get cached value (no lock)
   */
  async get<T>(prefix: string, key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const cacheKey = await this.buildCacheKey(prefix, key);
      const value = await this.redis.get(cacheKey);

      if (value) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return JSON.parse(value) as T;
      }

      this.logger.debug(`Cache MISS: ${cacheKey}`);
      return null;
    } catch (error) {
      this.logger.error(`Cache GET error: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Set cached value (no lock)
   */
  async set<T>(
    prefix: string,
    key: string,
    value: T,
    ttl: number = CACHE_TTL.SHORT,
  ): Promise<void> {
    if (!this.redis) return;

    try {
      const cacheKey = await this.buildCacheKey(prefix, key);
      await this.redis.setex(cacheKey, ttl, JSON.stringify(value));
      this.logger.debug(`Cache SET: ${cacheKey} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error(`Cache SET error: ${(error as Error).message}`);
    }
  }

  // ==================== MAIN METHOD: GET OR SET WITH DISTRIBUTED LOCK ====================

  /**
   * Get cached value or fetch from factory with DISTRIBUTED LOCKING
   *
   * Flow:
   * 1. Check cache → return if hit
   * 2. Acquire lock (other requests WAIT here, retry every 50ms for up to 5s)
   * 3. Double-check cache (winner may have populated it)
   * 4. Call factory to fetch from DB (ONLY 1 REQUEST DOES THIS)
   * 5. Set cache
   * 6. Release lock IMMEDIATELY in finally block
   *
   * @param prefix - Cache prefix (from cache-keys.constants.ts)
   * @param key - Cache key (e.g., sessionId)
   * @param factory - Async function to fetch data from DB
   * @param ttl - Cache TTL in seconds (default: 60)
   */
  async getOrSet<T>(
    prefix: string,
    key: string,
    factory: () => Promise<T>,
    ttl: number = CACHE_TTL.SHORT,
  ): Promise<T> {
    // Step 1: Quick cache check (no lock needed)
    const cached = await this.get<T>(prefix, key);
    if (cached !== null) {
      return cached;
    }

    // Step 2: Cache miss - need to fetch from DB
    // Acquire lock so only 1 request hits DB, others wait
    const lockKey = this.buildLockKey(prefix, key);
    let lockId: string | null = null;

    try {
      lockId = await this.acquireLock(lockKey);

      if (!lockId) {
        // Failed to acquire lock after all retries (5s timeout)
        // Fall back to direct DB fetch (better than throwing error)
        this.logger.warn(
          `Lock timeout, falling back to direct fetch: ${prefix}:${key}`,
        );
        return factory();
      }

      // Step 3: Double-check cache after acquiring lock
      // (While we were waiting, the winner may have populated cache)
      const cachedAfterLock = await this.get<T>(prefix, key);
      if (cachedAfterLock !== null) {
        this.logger.debug(`Cache HIT after lock wait: ${prefix}:${key}`);
        return cachedAfterLock;
      }

      // Step 4: We won the race - fetch from DB (ONLY THIS REQUEST HITS DB)
      this.logger.debug(`Fetching from DB (won lock): ${prefix}:${key}`);
      const result = await factory();

      // Step 5: Set cache so other waiting requests get from cache
      if (result !== null && result !== undefined) {
        await this.set(prefix, key, result, ttl);
      }

      return result;
    } finally {
      // Step 6: ALWAYS release lock IMMEDIATELY after DB fetch
      // This unblocks all waiting requests
      if (lockId) {
        await this.releaseLock(lockKey, lockId);
      }
    }
  }

  // ==================== CACHE INVALIDATION ====================

  /**
   * Invalidate all cache for a prefix by incrementing version
   */
  async invalidate(prefix: string): Promise<void> {
    await this.incrementVersion(prefix);
    this.logger.log(`Cache invalidated: ${prefix}`);
  }

  /**
   * Invalidate multiple prefixes at once
   */
  async invalidateMany(prefixes: string[]): Promise<void> {
    await Promise.all(prefixes.map((prefix) => this.incrementVersion(prefix)));
    this.logger.log(`Cache invalidated: ${prefixes.join(', ')}`);
  }

  // ==================== UTILITY ====================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.redis !== null && this.redis.status === 'ready';
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    versions: Record<string, number>;
  }> {
    if (!this.redis) {
      return { connected: false, versions: {} };
    }

    try {
      const keys = await this.redis.keys('version:*');
      const versions: Record<string, number> = {};

      for (const key of keys) {
        const prefix = key.replace('version:', '');
        const version = await this.redis.get(key);
        versions[prefix] = version ? parseInt(version, 10) : 1;
      }

      return { connected: true, versions };
    } catch {
      return { connected: false, versions: {} };
    }
  }
}
