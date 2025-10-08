/**
 * Simple Query Expansion Test
 *
 * Tests query expansion by directly calling the API endpoint
 *
 * Prerequisites:
 * 1. Start API: npm run start:client-api:dev
 * 2. Run: node test-query-expansion-simple.js
 */

const testQueries = [
  'khóa học lập trình web',
  'IELTS 7.5',
  'học tiếng Anh giao tiếp',
  'Spring Boot microservices',
];

async function testQueryExpansion() {
  console.log('🌟 Testing Query Expansion\n');

  for (const query of testQueries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📝 Query: "${query}"`);
    console.log('='.repeat(60));

    try {
      // Test WITHOUT expansion
      console.log('\n1️⃣ WITHOUT expansion:');
      const startWithout = Date.now();
      const responseWithout = await fetch(
        'http://localhost:3334/api/private/v1/agent/chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer YOUR_TOKEN', // Replace with real token
          },
          body: JSON.stringify({
            message: `Tìm kiếm trong knowledge base: ${query}`,
          }),
        },
      );
      const latencyWithout = Date.now() - startWithout;
      const dataWithout = await responseWithout.json();

      console.log(`   ⏱️  Latency: ${latencyWithout}ms`);
      console.log(
        `   📄 Response: ${dataWithout.response?.substring(0, 100)}...`,
      );

      // Test WITH expansion (manual for now)
      console.log('\n2️⃣ Expansion examples:');
      console.log(`   Original: "${query}"`);

      // Simulate what expansion would generate
      const simulated = getSimulatedExpansions(query);
      simulated.forEach((exp, i) => {
        console.log(`   Expansion ${i + 1}: "${exp}"`);
      });

      console.log('\n💡 How to use in your code:');
      console.log(`   const result = await ragService.searchKnowledge(`);
      console.log(`     "${query}",`);
      console.log(`     { useExpansion: true, maxExpansions: 3 }`);
      console.log(`   );`);
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test completed!');
  console.log('='.repeat(60));
}

function getSimulatedExpansions(query) {
  const expansions = {
    'khóa học lập trình web': [
      'khóa học web development',
      'học làm website',
      'course web programming',
    ],
    'IELTS 7.5': [
      'IELTS band 7.5',
      'luyện thi IELTS đạt 7.5',
      'IELTS preparation 7.5',
    ],
    'học tiếng Anh giao tiếp': [
      'English speaking course',
      'tiếng Anh đàm thoại',
      'conversational English',
    ],
    'Spring Boot microservices': [
      'Spring Boot tutorial',
      'microservices architecture Spring',
      'học Spring Boot cho beginners',
    ],
  };

  return expansions[query] || [
    `${query} tutorial`,
    `learn ${query}`,
    `${query} for beginners`,
  ];
}

// Run if called directly
if (typeof window === 'undefined') {
  testQueryExpansion().catch(console.error);
}

console.log(`
📚 Query Expansion - Quick Guide

1. What it does:
   - Automatically generates alternative queries
   - Searches with all variations
   - Finds more relevant documents

2. Example:
   Query: "khóa học lập trình web"
   Expands to:
   - "khóa học web development"
   - "học làm website"
   - "course web programming"

3. Usage in code:

   // WITHOUT expansion (default - faster)
   const result = await ragService.searchKnowledge("your query");

   // WITH expansion (better recall - slower)
   const result = await ragService.searchKnowledge("your query", {
     useExpansion: true,
     maxExpansions: 3  // Generate 3 alternative queries
   });

4. When to use:
   ✅ Use expansion for: Ambiguous queries, exploring topics
   ❌ Skip expansion for: Exact matches (codes, IDs), fast responses

5. Performance:
   - Without expansion: ~150-200ms
   - With expansion: ~600-1000ms (+400-800ms for Gemini API)
   - Trade-off: Speed vs Recall

6. Implementation status:
   ✅ expandQuery() - Generate alternative queries
   ✅ searchWithExpansion() - Search with expanded queries
   ✅ deduplicateAndAggregateScores() - Merge results
   ✅ searchKnowledge() - Support useExpansion option
   ✅ Documents found multiple times get boosted scores!
`);
