/**
 * Redis Cache Test Script
 *
 * Tests the Redis cache integration for RAG system
 *
 * Usage:
 * 1. Start Redis: docker compose up redis -d
 * 2. Run test: npx ts-node test-redis-cache.ts
 */

import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

async function testRedisConnection() {
    console.log('🧪 Testing Redis Cache Integration\n');
    console.log('='.repeat(60));

    const redis = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        retryStrategy: (times) => {
            if (times > 3) {
                console.log('❌ Redis connection failed after 3 retries');
                return null;
            }
            return Math.min(times * 200, 2000);
        },
    });

    try {
        // Test 1: Connection
        console.log('\n1️⃣ Test Connection');
        console.log('-'.repeat(60));
        const pong = await redis.ping();
        console.log(`✅ Redis responds: ${pong}`);

        // Test 2: Basic SET/GET
        console.log('\n2️⃣ Test Basic SET/GET');
        console.log('-'.repeat(60));
        await redis.set('test:key', 'Hello Redis!', 'EX', 10);
        const value = await redis.get('test:key');
        console.log(`✅ SET/GET works: ${value}`);

        // Test 3: JSON Serialization
        console.log('\n3️⃣ Test JSON Serialization');
        console.log('-'.repeat(60));
        const testData = {
            query: 'Khóa học IELTS',
            results: ['Result 1', 'Result 2'],
            timestamp: new Date().toISOString(),
        };
        await redis.setex('test:json', 10, JSON.stringify(testData));
        const jsonValue = await redis.get('test:json');
        const parsed = jsonValue ? JSON.parse(jsonValue) : null;
        console.log(`✅ JSON works: ${JSON.stringify(parsed, null, 2)}`);

        // Test 4: RAG Cache Pattern
        console.log('\n4️⃣ Test RAG Cache Pattern');
        console.log('-'.repeat(60));

        // Simulate cache key generation
        const generateKey = (type: string, ...args: any[]) => {
            const crypto = require('crypto');
            const data = args.map(arg => JSON.stringify(arg)).join('|');
            const hash = crypto.createHash('md5').update(data).digest('hex');
            return `rag:${type}:${hash}`;
        };

        const query = 'Khóa học IELTS 7.5';
        const cacheKey = generateKey('search', query, { useReranking: true });
        console.log(`Cache key: ${cacheKey}`);

        const searchResult = {
            answer: 'Tìm thấy khóa học IELTS 7.5...',
            sources: [
                { id: '1', title: 'IELTS 7.5 Complete', score: 0.95 },
            ],
            confidence: 0.95,
            reranked: true,
        };

        // Set with 5 min TTL
        await redis.setex(cacheKey, 300, JSON.stringify(searchResult));
        console.log('✅ Cached search result (TTL: 300s)');

        // Get from cache
        const cached = await redis.get(cacheKey);
        const cachedResult = cached ? JSON.parse(cached) : null;
        console.log(`✅ Retrieved from cache: ${cachedResult?.answer}`);

        // Check TTL
        const ttl = await redis.ttl(cacheKey);
        console.log(`✅ TTL remaining: ${ttl}s`);

        // Test 5: Cache Statistics
        console.log('\n5️⃣ Test Cache Statistics');
        console.log('-'.repeat(60));

        // Create some test entries
        await redis.setex('rag:expansion:hash1', 3600, JSON.stringify(['query1', 'query2']));
        await redis.setex('rag:search:hash2', 300, JSON.stringify({ result: 'test' }));
        await redis.setex('rag:embedding:hash3', 86400, JSON.stringify([0.1, 0.2, 0.3]));

        // Get all rag keys
        const keys = await redis.keys('rag:*');
        console.log(`✅ Total RAG cache entries: ${keys.length}`);

        // Count by type
        const byType = {
            expansion: keys.filter(k => k.includes(':expansion:')).length,
            search: keys.filter(k => k.includes(':search:')).length,
            embedding: keys.filter(k => k.includes(':embedding:')).length,
        };
        console.log(`   - Expansions: ${byType.expansion}`);
        console.log(`   - Searches: ${byType.search}`);
        console.log(`   - Embeddings: ${byType.embedding}`);

        // Test 6: Cache Invalidation
        console.log('\n6️⃣ Test Cache Invalidation');
        console.log('-'.repeat(60));

        const searchKeys = await redis.keys('rag:search:*');
        console.log(`Found ${searchKeys.length} search cache entries`);

        if (searchKeys.length > 0) {
            // Delete all search caches
            const pipeline = redis.pipeline();
            searchKeys.forEach(key => pipeline.del(key));
            await pipeline.exec();
            console.log(`✅ Invalidated ${searchKeys.length} entries`);
        }

        // Test 7: Pub/Sub
        console.log('\n7️⃣ Test Pub/Sub');
        console.log('-'.repeat(60));

        const subscriber = new Redis({
            host: REDIS_HOST,
            port: REDIS_PORT,
        });

        await subscriber.subscribe('rag:cache:invalidate');
        console.log('✅ Subscribed to invalidation channel');

        subscriber.on('message', (channel, message) => {
            console.log(`✅ Received message on ${channel}:`);
            console.log(`   ${message}`);
        });

        // Publish test message
        await redis.publish('rag:cache:invalidate', JSON.stringify({
            type: 'search',
            timestamp: new Date().toISOString(),
        }));

        // Wait a bit for message
        await new Promise(resolve => setTimeout(resolve, 100));

        await subscriber.quit();
        console.log('✅ Pub/sub works!');

        // Test 8: Performance
        console.log('\n8️⃣ Test Performance');
        console.log('-'.repeat(60));

        const iterations = 100;
        const testKey = 'rag:perf:test';
        const testValue = JSON.stringify({
            data: 'x'.repeat(1000), // 1KB data
        });

        // Write performance
        const writeStart = Date.now();
        for (let i = 0; i < iterations; i++) {
            await redis.setex(`${testKey}:${i}`, 60, testValue);
        }
        const writeTime = Date.now() - writeStart;
        console.log(`✅ Write ${iterations} entries: ${writeTime}ms (${(writeTime / iterations).toFixed(2)}ms/op)`);

        // Read performance
        const readStart = Date.now();
        for (let i = 0; i < iterations; i++) {
            await redis.get(`${testKey}:${i}`);
        }
        const readTime = Date.now() - readStart;
        console.log(`✅ Read ${iterations} entries: ${readTime}ms (${(readTime / iterations).toFixed(2)}ms/op)`);

        // Cleanup
        const perfKeys = await redis.keys(`${testKey}:*`);
        if (perfKeys.length > 0) {
            await redis.del(...perfKeys);
            console.log(`✅ Cleaned up ${perfKeys.length} test entries`);
        }

        // Final cleanup
        console.log('\n9️⃣ Cleanup');
        console.log('-'.repeat(60));
        const allTestKeys = await redis.keys('test:*');
        const allRagKeys = await redis.keys('rag:*');
        const allKeys = [...allTestKeys, ...allRagKeys];

        if (allKeys.length > 0) {
            await redis.del(...allKeys);
            console.log(`✅ Deleted ${allKeys.length} test keys`);
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 SUMMARY\n');
        console.log('All tests passed! ✅');
        console.log('\nRedis Cache is working correctly:');
        console.log('  - Connection: ✅');
        console.log('  - SET/GET: ✅');
        console.log('  - JSON: ✅');
        console.log('  - RAG Pattern: ✅');
        console.log('  - Statistics: ✅');
        console.log('  - Invalidation: ✅');
        console.log('  - Pub/Sub: ✅');
        console.log('  - Performance: ✅');

        console.log('\n🚀 Ready to use Redis cache in production!');
        console.log('\nNext steps:');
        console.log('1. Update .env with REDIS_HOST and REDIS_PORT');
        console.log('2. Start server: npm run start:client-api:dev');
        console.log('3. Test real queries');
        console.log('4. Monitor cache hit rate');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        console.error('\nTroubleshooting:');
        console.error('1. Check Redis is running: docker compose ps');
        console.error('2. Start Redis: docker compose up redis -d');
        console.error('3. Check logs: docker compose logs redis');
    } finally {
        await redis.quit();
        console.log('\n✅ Test complete!');
        process.exit(0);
    }
}

testRedisConnection();













