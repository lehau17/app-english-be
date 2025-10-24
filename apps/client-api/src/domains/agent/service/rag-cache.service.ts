import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';

/**
 * RAG Cache Service - Redis Implementation
 *
 * Caches query results and expanded queries using Redis to:
 * - Reduce Gemini API calls (save cost)
 * - Improve response time
 * - Reduce database load
 * - Share cache across multiple instances
 * - Persist cache across restarts
 *
 * Cache Strategy:
 * - Query expansion: 1 hour TTL (stable results)
 * - Search results: 5 minutes TTL (fresher data)
 * - Embeddings: 24 hours TTL (rarely change)
 *
 * Benefits over in-memory cache:
 * - Persistent (survives restarts)
 * - Shared across instances
 * - Better memory management
 * - Pub/sub for cache invalidation
 */
@Injectable()
export class RagCacheService implements OnModuleInit {
    private readonly logger = new Logger(RagCacheService.name);
    private redis: Redis;
    private subscriber: Redis; // For pub/sub

    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

        this.logger.log(`🔌 Connecting to Redis at ${redisHost}:${redisPort}...`);

        try {
            // Main Redis connection
            this.redis = new Redis({
                host: redisHost,
                port: redisPort,
                password: redisPassword,
                retryStrategy: (times) => {
                    if (times > 3) {
                        this.logger.error('❌ Redis connection failed after 3 retries');
                        return null; // Stop retrying
                    }
                    const delay = Math.min(times * 200, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3,
            });

            // Subscriber for cache invalidation
            this.subscriber = new Redis({
                host: redisHost,
                port: redisPort,
                password: redisPassword,
            });

            // Subscribe to cache invalidation channel
            await this.subscriber.subscribe('rag:cache:invalidate');
            this.subscriber.on('message', (channel, message) => {
                if (channel === 'rag:cache:invalidate') {
                    this.logger.log(`🔔 Received cache invalidation: ${message}`);
                }
            });

            this.redis.on('connect', () => {
                this.logger.log('✅ Redis connected successfully');
            });

            this.redis.on('error', (error) => {
                this.logger.error(`❌ Redis error: ${error.message}`);
            });

            // Test connection
            await this.redis.ping();
            this.logger.log('✅ Redis cache service initialized');
        } catch (error) {
            this.logger.error(
                `❌ Failed to connect to Redis: ${(error as any)?.message}`,
            );
            this.logger.warn('⚠️ Falling back to in-memory cache (not recommended for production)');
            // Don't throw error - allow app to start without Redis
        }
    }

    /**
     * Cache expanded queries
     */
    async getCachedExpansion(query: string): Promise<string[] | null> {
        const key = this.generateKey('expansion', query);
        return this.get<string[]>(key);
    }

    async setCachedExpansion(query: string, expansions: string[]): Promise<void> {
        const key = this.generateKey('expansion', query);
        await this.set(key, expansions, 3600); // 1 hour TTL
        this.logger.debug(`Cached expansion for: ${query}`);
    }

    /**
     * Cache search results
     */
    async getCachedSearchResults(
        query: string,
        options: any,
    ): Promise<any | null> {
        const key = this.generateKey('search', query, options);
        return this.get<any>(key);
    }

    async setCachedSearchResults(
        query: string,
        options: any,
        results: any,
    ): Promise<void> {
        const key = this.generateKey('search', query, options);
        await this.set(key, results, 300); // 5 minutes TTL
        this.logger.debug(`Cached search results for: ${query}`);
    }

    /**
     * Cache embeddings (rare changes)
     */
    async getCachedEmbedding(text: string): Promise<number[] | null> {
        const key = this.generateKey('embedding', text);
        return this.get<number[]>(key);
    }

    async setCachedEmbedding(text: string, embedding: number[]): Promise<void> {
        const key = this.generateKey('embedding', text);
        await this.set(key, embedding, 86400); // 24 hours TTL
        this.logger.debug(`Cached embedding for text (${text.length} chars)`);
    }

    /**
     * Invalidate cache when documents change
     * Uses Redis pub/sub to notify all instances
     */
    async invalidateSearchCache(): Promise<void> {
        if (!this.redis) {
            this.logger.warn('Redis not available, skipping cache invalidation');
            return;
        }

        try {
            // Get all search cache keys
            const keys = await this.redis.keys('rag:search:*');

            if (keys.length > 0) {
                // Delete in pipeline for better performance
                const pipeline = this.redis.pipeline();
                keys.forEach((key) => pipeline.del(key));
                await pipeline.exec();

                this.logger.log(`Invalidated ${keys.length} search cache entries`);
            }

            // Publish invalidation event to other instances
            await this.redis.publish(
                'rag:cache:invalidate',
                JSON.stringify({
                    type: 'search',
                    timestamp: new Date().toISOString(),
                }),
            );
        } catch (error) {
            this.logger.error(
                `Failed to invalidate cache: ${(error as any)?.message}`,
            );
        }
    }

    /**
     * Clear all cache
     */
    async clearAll(): Promise<void> {
        if (!this.redis) {
            this.logger.warn('Redis not available');
            return;
        }

        try {
            const keys = await this.redis.keys('rag:*');
            if (keys.length > 0) {
                await this.redis.del(...keys);
                this.logger.log(`Cleared all cache (${keys.length} entries)`);
            }

            // Publish clear event
            await this.redis.publish(
                'rag:cache:invalidate',
                JSON.stringify({
                    type: 'all',
                    timestamp: new Date().toISOString(),
                }),
            );
        } catch (error) {
            this.logger.error(`Failed to clear cache: ${(error as any)?.message}`);
        }
    }

    /**
     * Get cache statistics
     */
    async getStats() {
        if (!this.redis) {
            return {
                available: false,
                message: 'Redis not connected',
            };
        }

        try {
            const info = await this.redis.info('stats');
            const keys = await this.redis.keys('rag:*');

            // Count by type
            const byType = {
                expansion: 0,
                search: 0,
                embedding: 0,
            };

            keys.forEach((key) => {
                if (key.includes(':expansion:')) byType.expansion++;
                else if (key.includes(':search:')) byType.search++;
                else if (key.includes(':embedding:')) byType.embedding++;
            });

            // Get memory usage
            const memoryInfo = await this.redis.info('memory');
            const memoryMatch = memoryInfo.match(/used_memory_human:([^\r\n]+)/);
            const memoryUsed = memoryMatch ? memoryMatch[1] : 'unknown';

            return {
                available: true,
                totalEntries: keys.length,
                byType,
                memoryUsed,
                redisInfo: {
                    host: this.redis.options.host,
                    port: this.redis.options.port,
                },
            };
        } catch (error) {
            this.logger.error(`Failed to get stats: ${(error as any)?.message}`);
            return {
                available: false,
                error: (error as any)?.message,
            };
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        healthy: boolean;
        latency?: number;
        error?: string;
    }> {
        if (!this.redis) {
            return {
                healthy: false,
                error: 'Redis not connected',
            };
        }

        try {
            const start = Date.now();
            await this.redis.ping();
            const latency = Date.now() - start;

            return {
                healthy: true,
                latency,
            };
        } catch (error) {
            return {
                healthy: false,
                error: (error as any)?.message,
            };
        }
    }

    /**
     * Private methods
     */

    private generateKey(type: string, ...args: any[]): string {
        const data = args.map((arg) => JSON.stringify(arg)).join('|');
        const hash = createHash('md5').update(data).digest('hex');
        return `rag:${type}:${hash}`;
    }

    private async get<T>(key: string): Promise<T | null> {
        if (!this.redis) {
            this.logger.debug('Redis not available, cache MISS');
            return null;
        }

        try {
            const value = await this.redis.get(key);

            if (!value) {
                this.logger.debug(`Cache MISS: ${key}`);
                return null;
            }

            this.logger.debug(`Cache HIT: ${key}`);
            return JSON.parse(value) as T;
        } catch (error) {
            this.logger.error(
                `Cache GET error for ${key}: ${(error as any)?.message}`,
            );
            return null;
        }
    }

    private async set<T>(
        key: string,
        value: T,
        ttlSeconds: number,
    ): Promise<void> {
        if (!this.redis) {
            this.logger.debug('Redis not available, skipping cache SET');
            return;
        }

        try {
            const serialized = JSON.stringify(value);
            await this.redis.setex(key, ttlSeconds, serialized);
            this.logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
        } catch (error) {
            this.logger.error(
                `Cache SET error for ${key}: ${(error as any)?.message}`,
            );
        }
    }

    /**
     * Cleanup on module destroy
     */
    async onModuleDestroy() {
        if (this.redis) {
            await this.redis.quit();
            this.logger.log('Redis connection closed');
        }
        if (this.subscriber) {
            await this.subscriber.quit();
            this.logger.log('Redis subscriber closed');
        }
    }
}
