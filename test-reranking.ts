/**
 * Re-ranking Test Script
 *
 * Tests the accuracy improvement from reranking
 *
 * Usage:
 * ts-node test-reranking.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const testQueries = [
    {
        query: 'Khóa học IELTS 7.5',
        expectedTop: 'IELTS', // Expected keyword in top result
    },
    {
        query: 'Học ngữ pháp tiếng Anh cơ bản',
        expectedTop: 'Grammar',
    },
    {
        query: 'Bài tập listening nâng cao',
        expectedTop: 'Listening',
    },
    {
        query: 'Từ vựng chủ đề du lịch',
        expectedTop: 'Travel',
    },
    {
        query: 'Present Perfect tense usage',
        expectedTop: 'Present Perfect',
    },
];

interface SearchResult {
    answer: string;
    sources: Array<{
        id: string;
        title: string;
        finalScore: number;
        rerankScore?: number;
        originalScore?: number;
    }>;
    confidence: number;
    reranked?: boolean;
}

async function callSearchAPI(
    query: string,
    options: any = {},
): Promise<SearchResult> {
    const response = await fetch('http://localhost:3334/api/public/v1/ai/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, ...options }),
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    return response.json();
}

async function testReranking() {
    console.log('🧪 Testing Re-ranking Accuracy\n');
    console.log('='.repeat(60));

    const results: any[] = [];

    for (const testCase of testQueries) {
        console.log(`\n📝 Query: "${testCase.query}"`);
        console.log('-'.repeat(60));

        try {
            // 1. Without reranking
            console.log('\n1️⃣ Without Re-ranking:');
            const noRerank = await callSearchAPI(testCase.query, {
                useReranking: false,
            });

            const noRerankTop = noRerank.sources[0];
            console.log(`   Top: ${noRerankTop.title}`);
            console.log(`   Score: ${noRerankTop.finalScore.toFixed(3)}`);

            // 2. With Cohere reranking (if available)
            console.log('\n2️⃣ With Cohere Re-ranking:');
            try {
                const cohere = await callSearchAPI(testCase.query, {
                    useReranking: true,
                    rerankStrategy: 'cohere',
                });

                const cohereTop = cohere.sources[0];
                console.log(`   Top: ${cohereTop.title}`);
                console.log(`   Rerank Score: ${cohereTop.rerankScore?.toFixed(3)}`);
                console.log(
                    `   Original Score: ${cohereTop.originalScore?.toFixed(3)}`,
                );

                // Check if ranking improved
                const improved =
                    cohereTop.id !== noRerankTop.id ||
                    (cohereTop.rerankScore || 0) > noRerankTop.finalScore;
                console.log(`   ${improved ? '✅ Improved' : '➖ Same'}`);

                results.push({
                    query: testCase.query,
                    noRerank: noRerankTop.title,
                    cohere: cohereTop.title,
                    improved,
                    cohereAvailable: true,
                });
            } catch (error: any) {
                console.log(`   ❌ Cohere not available: ${error.message}`);
                results.push({
                    query: testCase.query,
                    noRerank: noRerankTop.title,
                    cohere: null,
                    improved: false,
                    cohereAvailable: false,
                });
            }

            // 3. With Gemini reranking
            console.log('\n3️⃣ With Gemini Re-ranking:');
            const gemini = await callSearchAPI(testCase.query, {
                useReranking: true,
                rerankStrategy: 'gemini',
            });

            const geminiTop = gemini.sources[0];
            console.log(`   Top: ${geminiTop.title}`);
            console.log(`   Rerank Score: ${geminiTop.rerankScore?.toFixed(3)}`);
            console.log(`   Original Score: ${geminiTop.originalScore?.toFixed(3)}`);

            const geminiImproved =
                geminiTop.id !== noRerankTop.id ||
                (geminiTop.rerankScore || 0) > noRerankTop.finalScore;
            console.log(`   ${geminiImproved ? '✅ Improved' : '➖ Same'}`);
        } catch (error: any) {
            console.log(`\n   ❌ Error: ${error.message}`);
            results.push({
                query: testCase.query,
                error: error.message,
            });
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY\n');

    const improved = results.filter((r) => r.improved).length;
    const total = results.filter((r) => !r.error).length;
    const accuracy = total > 0 ? ((improved / total) * 100).toFixed(1) : '0';

    console.log(`Total Queries: ${testQueries.length}`);
    console.log(`Successful: ${total}`);
    console.log(`Improved with Reranking: ${improved}/${total} (${accuracy}%)`);
    console.log(`Cohere Available: ${results.some((r) => r.cohereAvailable) ? '✅' : '❌'}`);

    console.log('\n📋 Detailed Results:');
    console.log('-'.repeat(60));
    results.forEach((r, i) => {
        if (r.error) {
            console.log(`${i + 1}. ${r.query}: ❌ ${r.error}`);
        } else {
            console.log(`${i + 1}. ${r.query}`);
            console.log(`   No Rerank: ${r.noRerank}`);
            if (r.cohere) {
                console.log(`   Cohere:    ${r.cohere} ${r.improved ? '✅' : '➖'}`);
            }
        }
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test Complete!\n');
}

async function testHealth() {
    console.log('🔍 Checking Re-ranker Health...\n');

    try {
        const response = await fetch(
            'http://localhost:3334/api/public/v1/ai/rerank/health',
        );

        if (!response.ok) {
            console.log('❌ Health check endpoint not found');
            console.log('💡 Add health check endpoint to controller\n');
            return;
        }

        const health = await response.json();

        console.log('Health Status:');
        console.log(`  Cohere:      ${health.cohere ? '✅ Available' : '❌ Not configured'}`);
        console.log(`  Gemini:      ${health.gemini ? '✅ Available' : '❌ Not available'}`);
        console.log(`  Recommended: ${health.recommended}\n`);

        if (!health.cohere) {
            console.log('💡 To enable Cohere:');
            console.log('   1. Get API key: https://cohere.com');
            console.log('   2. Add to .env: COHERE_API_KEY=your-key');
            console.log('   3. Restart server\n');
        }
    } catch (error: any) {
        console.log(`❌ Health check failed: ${error.message}\n`);
    }
}

async function main() {
    console.log('🚀 Re-ranking Test Suite\n');

    // Check if server is running
    try {
        await fetch('http://localhost:3334/api/public/v1/ai/health');
    } catch (error) {
        console.log('❌ Server is not running at http://localhost:3334');
        console.log('💡 Start server: npm run start:client-api:dev\n');
        process.exit(1);
    }

    await testHealth();
    await testReranking();

    await prisma.$disconnect();
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});


