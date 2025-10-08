import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * RAG Cache Service
 *
 * Caches query results and expanded queries to:
 * - Reduce Gemini API calls (save cost)
 * - Improve response time
 * - Reduce database load
 *
 * Cache Strategy:
 * - Query expansion: 1 hour TTL (stable results)
 * - Search results: 5 minutes TTL (fresher data)
 * - Embeddings: 24 hours TTL (rarely change)
 */
@Injectable()
export class RagCacheService {
  private readonly logger = new Logger(RagCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxSize = 1000; // Max 1000 entries in memory

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
   */
  async invalidateSearchCache(): Promise<void> {
    let invalidated = 0;
    for (const [key] of this.cache) {
      if (key.startsWith('search:')) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    this.logger.log(`Invalidated ${invalidated} search cache entries`);
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.log(`Cleared all cache (${size} entries)`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();

    const stats = {
      totalEntries: this.cache.size,
      maxSize: this.maxSize,
      byType: {
        expansion: 0,
        search: 0,
        embedding: 0,
      },
      expired: 0,
      memoryEstimate: 0, // KB
    };

    entries.forEach(([key, entry]) => {
      // Count by type
      if (key.startsWith('expansion:')) stats.byType.expansion++;
      else if (key.startsWith('search:')) stats.byType.search++;
      else if (key.startsWith('embedding:')) stats.byType.embedding++;

      // Count expired
      if (entry.expiresAt < now) stats.expired++;

      // Estimate memory (rough)
      stats.memoryEstimate += JSON.stringify(entry.value).length;
    });

    stats.memoryEstimate = Math.round(stats.memoryEstimate / 1024); // Convert to KB

    return stats;
  }

  /**
   * Private methods
   */

  private generateKey(type: string, ...args: any[]): string {
    const data = args.map((arg) => JSON.stringify(arg)).join('|');
    const hash = createHash('md5').update(data).digest('hex');
    return `${type}:${hash}`;
  }

  private async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.logger.debug(`Cache MISS: ${key}`);
      return null;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.logger.debug(`Cache EXPIRED: ${key}`);
      return null;
    }

    this.logger.debug(`Cache HIT: ${key}`);
    return entry.value as T;
  }

  private async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.logger.debug(`Cache EVICTED: ${firstKey}`);
    }

    const entry: CacheEntry = {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };

    this.cache.set(key, entry);
  }
}

interface CacheEntry {
  value: any;
  expiresAt: number; // Timestamp
}
