/**
 * Test script for AI vocabulary unit suggestions
 * Usage: npx ts-node scripts/test-vocabulary-ai-suggest.ts
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3334';
const TEST_LIST_ID = process.env.TEST_LIST_ID; // Set this to test a specific list

async function testAiSuggest() {
  console.log('🧪 Testing AI Vocabulary Unit Suggestions\n');

  if (!TEST_LIST_ID) {
    console.error('Please set TEST_LIST_ID environment variable');
    console.log('Example: TEST_LIST_ID=your-list-id npm run test:ai-suggest');
    process.exit(1);
  }

  try {
    // Step 1: Get list info
    console.log(`Fetching list ${TEST_LIST_ID}...`);
    const listResponse = await axios.get(
      `${API_BASE_URL}/private/v1/vocabulary/lists/${TEST_LIST_ID}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_TOKEN}`, // You need a valid token
        },
      },
    );

    const list = listResponse.data.data;
    console.log(`List: ${list.title}`);
    console.log(`   - Language: ${list.language}`);
    console.log(`   - Total Units: ${list.totalUnits}`);
    console.log(`   - Total Terms: ${list.totalTerms}\n`);

    // Step 2: Get existing units
    console.log('Fetching existing units...');
    const unitsResponse = await axios.get(
      `${API_BASE_URL}/private/v1/vocabulary/lists/${TEST_LIST_ID}/units`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_TOKEN}`,
        },
      },
    );

    const units = unitsResponse.data.data;
    console.log(`Found ${units.length} units:`);
    units.forEach((unit: any, i: number) => {
      console.log(`   ${i + 1}. ${unit.title}`);
    });
    console.log();

    // Step 3: Request AI suggestions
    console.log('🤖 Requesting AI suggestions...');
    const startTime = Date.now();

    const suggestResponse = await axios.post(
      `${API_BASE_URL}/private/v1/admin/vocabulary/lists/${TEST_LIST_ID}/units/suggest`,
      {},
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_TOKEN}`,
        },
      },
    );

    const duration = Date.now() - startTime;
    const suggestions = suggestResponse.data.data.suggestions;

    console.log(`Received ${suggestions.length} suggestions in ${duration}ms\n`);

    // Step 4: Display suggestions
    suggestions.forEach((suggestion: any, i: number) => {
      console.log(`Suggestion ${i + 1}:`);
      console.log(`   Title: ${suggestion.title}`);
      console.log(`   Description: ${suggestion.description}`);
      console.log();
    });

    // Step 5: Check for duplicates
    const existingTitles = units.map((u: any) => u.title.toLowerCase());
    const duplicates = suggestions.filter((s: any) =>
      existingTitles.includes(s.title.toLowerCase()),
    );

    if (duplicates.length > 0) {
      console.log(' WARNING: Found duplicate suggestions:');
      duplicates.forEach((d: any) => console.log(`   - ${d.title}`));
    } else {
      console.log('No duplicates detected');
    }

    console.log('\n✨ Test completed successfully!');
  } catch (error: any) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

testAiSuggest();
