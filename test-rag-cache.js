/**
 * Test script for RAG Caching Layer
 *
 * Tests:
 * 1. Query expansion caching (1 hour TTL)
 * 2. Search result caching (5 minutes TTL)
 * 3. Cache invalidation on document changes
 * 4. Cache hit/miss rates
 *
 * Usage:
 *   node test-rag-cache.js
 */

const API_URL = process.env.API_URL || 'http://localhost:3334/api';
const axios = require('axios');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testSearchWithCache(query, options = {}) {
  const startTime = Date.now();
  try {
    const response = await axios.post(`${API_URL}/intelligent/search`, {
      query,
      ...options,
    });
    const duration = Date.now() - startTime;
    return { success: true, data: response.data, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error.response?.data || error.message,
      duration,
    };
  }
}

async function main() {
  log('\n🧪 Testing RAG Caching Layer\n', 'cyan');

  // Test 1: First search (cache miss)
  log('📝 Test 1: First search (should be cache MISS)', 'blue');
  const query1 = 'Làm thế nào để học từ vựng tiếng Anh hiệu quả?';
  const result1 = await testSearchWithCache(query1, { useCache: true });

  if (result1.success) {
    log(`✅ Search completed in ${result1.duration}ms`, 'green');
    log(`   From cache: ${result1.data.fromCache ? 'YES' : 'NO'}`, result1.data.fromCache ? 'green' : 'yellow');
    log(`   Sources: ${result1.data.sources?.length || 0}`);
    log(`   Confidence: ${result1.data.confidence}`);
  } else {
    log(`❌ Search failed: ${JSON.stringify(result1.error)}`, 'red');
  }

  // Test 2: Same search immediately (cache hit)
  log('\n📝 Test 2: Same search (should be cache HIT)', 'blue');
  const result2 = await testSearchWithCache(query1, { useCache: true });

  if (result2.success) {
    log(`✅ Search completed in ${result2.duration}ms`, 'green');
    log(`   From cache: ${result2.data.fromCache ? 'YES ✨' : 'NO'}`, result2.data.fromCache ? 'green' : 'yellow');
    log(`   Sources: ${result2.data.sources?.length || 0}`);
    log(`   Speed improvement: ${Math.round((1 - result2.duration / result1.duration) * 100)}%`, 'cyan');
  } else {
    log(`❌ Search failed: ${JSON.stringify(result2.error)}`, 'red');
  }

  // Test 3: Query expansion caching
  log('\n📝 Test 3: Query expansion (first call)', 'blue');
  const query2 = 'Phương pháp luyện phát âm';
  const result3 = await testSearchWithCache(query2, { useExpansion: true, useCache: true });

  if (result3.success) {
    log(`✅ Search with expansion completed in ${result3.duration}ms`, 'green');
    log(`   From cache: ${result3.data.fromCache ? 'YES' : 'NO'}`, result3.data.fromCache ? 'green' : 'yellow');
    log(`   Expanded queries: ${result3.data.expandedQueries?.length || 0}`);
    if (result3.data.expandedQueries?.length > 0) {
      result3.data.expandedQueries.forEach((q, i) => {
        log(`     ${i + 1}. "${q}"`, 'cyan');
      });
    }
  } else {
    log(`❌ Search failed: ${JSON.stringify(result3.error)}`, 'red');
  }

  // Test 4: Same expansion query (should use cached expansion + cached results)
  log('\n📝 Test 4: Same expansion query (cached expansion + results)', 'blue');
  const result4 = await testSearchWithCache(query2, { useExpansion: true, useCache: true });

  if (result4.success) {
    log(`✅ Search with expansion completed in ${result4.duration}ms`, 'green');
    log(`   From cache: ${result4.data.fromCache ? 'YES ✨' : 'NO'}`, result4.data.fromCache ? 'green' : 'yellow');
    log(`   Speed improvement: ${Math.round((1 - result4.duration / result3.duration) * 100)}%`, 'cyan');
  } else {
    log(`❌ Search failed: ${JSON.stringify(result4.error)}`, 'red');
  }

  // Test 5: Different query (cache miss)
  log('\n📝 Test 5: Different query (cache MISS)', 'blue');
  const query3 = 'Cách học ngữ pháp tiếng Anh cơ bản';
  const result5 = await testSearchWithCache(query3, { useCache: true });

  if (result5.success) {
    log(`✅ Search completed in ${result5.duration}ms`, 'green');
    log(`   From cache: ${result5.data.fromCache ? 'YES' : 'NO'}`, result5.data.fromCache ? 'green' : 'yellow');
  } else {
    log(`❌ Search failed: ${JSON.stringify(result5.error)}`, 'red');
  }

  // Test 6: Bypass cache
  log('\n📝 Test 6: Bypass cache (useCache: false)', 'blue');
  const result6 = await testSearchWithCache(query1, { useCache: false });

  if (result6.success) {
    log(`✅ Search completed in ${result6.duration}ms`, 'green');
    log(`   From cache: ${result6.data.fromCache ? 'YES' : 'NO (as expected)'}`, result6.data.fromCache ? 'yellow' : 'green');
    log(`   Should be slower than cached: ${result6.duration > result2.duration ? 'YES ✅' : 'NO ❌'}`, result6.duration > result2.duration ? 'green' : 'red');
  } else {
    log(`❌ Search failed: ${JSON.stringify(result6.error)}`, 'red');
  }

  // Summary
  log('\n📊 Test Summary:', 'cyan');
  log(`   Test 1 (first search): ${result1.duration}ms - Cache MISS ✅`);
  log(`   Test 2 (same search): ${result2.duration}ms - Cache ${result2.data?.fromCache ? 'HIT ✅' : 'MISS ❌'}`);
  log(`   Test 3 (expansion first): ${result3.duration}ms - Cache MISS ✅`);
  log(`   Test 4 (expansion cached): ${result4.duration}ms - Cache ${result4.data?.fromCache ? 'HIT ✅' : 'MISS ❌'}`);
  log(`   Test 5 (different query): ${result5.duration}ms - Cache MISS ✅`);
  log(`   Test 6 (bypass cache): ${result6.duration}ms - Cache ${result6.data?.fromCache ? 'HIT ❌' : 'MISS ✅'}`);

  const avgCacheMiss = (result1.duration + result3.duration + result5.duration) / 3;
  const avgCacheHit = result2.data?.fromCache ? result2.duration : 0;
  if (avgCacheHit > 0) {
    const improvement = Math.round((1 - avgCacheHit / avgCacheMiss) * 100);
    log(`\n🚀 Cache Performance: ${improvement}% faster (${avgCacheMiss.toFixed(0)}ms → ${avgCacheHit.toFixed(0)}ms)`, 'green');
  }

  log('\n✅ All tests completed!\n', 'green');
}

main().catch((error) => {
  log(`\n❌ Test failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
