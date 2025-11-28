import * as crypto from 'crypto';

/**
 * Hash Utility
 *
 * Provides consistent hashing for objects (DTOs, filters, etc.)
 * Used for cache key generation with deterministic results.
 */
export class HashUtil {
  /**
   * Generate MD5 hash from an object
   * Sorts keys recursively to ensure consistent hash for same data
   *
   * @param obj - Object to hash (DTO, filter, etc.)
   * @returns MD5 hash string (32 characters)
   *
   * @example
   * const filter = { page: 1, limit: 10, status: 'active' };
   * const hash = HashUtil.hashObject(filter);
   * // => "a1b2c3d4e5f6..."
   *
   * // Same result regardless of key order
   * const filter2 = { status: 'active', limit: 10, page: 1 };
   * HashUtil.hashObject(filter) === HashUtil.hashObject(filter2) // true
   */
  static hashObject(obj: unknown): string {
    const normalized = this.sortObjectKeys(obj);
    const jsonString = JSON.stringify(normalized);
    return crypto.createHash('md5').update(jsonString).digest('hex');
  }

  /**
   * Generate short hash (8 characters) for compact cache keys
   *
   * @param obj - Object to hash
   * @returns Short MD5 hash (8 characters)
   */
  static hashObjectShort(obj: unknown): string {
    return this.hashObject(obj).substring(0, 8);
  }

  /**
   * Generate hash from string
   *
   * @param str - String to hash
   * @returns MD5 hash string
   */
  static hashString(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * Generate cache key from prefix and filter object
   *
   * @param prefix - Cache key prefix
   * @param filter - Filter/DTO object
   * @returns Cache key string
   *
   * @example
   * const key = HashUtil.buildCacheKey('attendance:history', { page: 1, limit: 10 });
   * // => "attendance:history:a1b2c3d4"
   */
  static buildCacheKey(prefix: string, filter: unknown): string {
    const hash = this.hashObjectShort(filter);
    return `${prefix}:${hash}`;
  }

  /**
   * Sort object keys recursively for consistent serialization
   * Handles nested objects and arrays
   *
   * @param obj - Object to sort
   * @returns Object with sorted keys
   */
  private static sortObjectKeys(obj: unknown): unknown {
    // Handle null/undefined
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle arrays - sort elements if they are objects
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortObjectKeys(item));
    }

    // Handle Date objects
    if (obj instanceof Date) {
      return obj.toISOString();
    }

    // Handle plain objects
    if (typeof obj === 'object') {
      const sorted: Record<string, unknown> = {};
      const keys = Object.keys(obj as Record<string, unknown>).sort();

      for (const key of keys) {
        const value = (obj as Record<string, unknown>)[key];
        // Skip undefined values
        if (value !== undefined) {
          sorted[key] = this.sortObjectKeys(value);
        }
      }

      return sorted;
    }

    // Return primitives as-is
    return obj;
  }

  /**
   * Compare two objects for equality (using hash)
   *
   * @param obj1 - First object
   * @param obj2 - Second object
   * @returns true if objects have same hash
   */
  static isEqual(obj1: unknown, obj2: unknown): boolean {
    return this.hashObject(obj1) === this.hashObject(obj2);
  }
}
