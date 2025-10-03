#!/usr/bin/env node

/**
 * Test script để kiểm tra auto-reindex functionality
 *
 * Usage:
 *   cd english-learning
 *   node scripts/test-auto-reindex.js
 */

const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:3334';
const AUTH_TOKEN = process.env.TEST_TOKEN || 'your-test-token';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function testAutoReindex() {
  console.log('🧪 Testing Auto-Reindex Functionality...\n');

  try {
    // 1. Check auto-reindex status
    console.log('1️⃣ Checking auto-reindex status...');
    const statusResponse = await api.get('/agent/knowledge/auto-reindex/status');
    console.log('✅ Status:', statusResponse.data);
    console.log();

    // 2. Create a test course (this should trigger auto-reindex)
    console.log('2️⃣ Creating test course...');
    const courseData = {
      title: 'Test Auto-Reindex Course',
      description: 'This course is created to test auto-reindex functionality',
      difficulty: 'beginner',
      instructorId: 'test-instructor-id', // Replace with actual instructor ID
      lessons: [
        {
          title: 'Test Lesson 1',
          description: 'First test lesson',
          orderNo: 1,
          difficulty: 'beginner',
          estimatedTime: 30,
          objectives: ['Learn auto-reindex', 'Test knowledge base'],
          activities: [
            {
              title: 'Test Activity 1',
              type: 'vocab',
              orderNo: 1,
              content: {
                items: [
                  {
                    word: 'test',
                    definition: 'A procedure intended to establish the quality, performance, or reliability of something',
                    audioUrl: ''
                  }
                ]
              },
              points: 10
            }
          ]
        }
      ]
    };

    try {
      const courseResponse = await api.post('/private/v1/courses', courseData);
      const courseId = courseResponse.data.data.id;
      console.log('✅ Course created:', courseId);

      // Wait a bit for auto-reindex to process
      console.log('⏳ Waiting for auto-reindex to process...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 3. Search for the course in knowledge base
      console.log('3️⃣ Searching for course in knowledge base...');
      const searchResponse = await api.post('/agent/chat', {
        message: 'Tell me about Test Auto-Reindex Course'
      });
      console.log('✅ Search result:', searchResponse.data.response);
      console.log();

      // 4. Update the course (should trigger auto-reindex)
      console.log('4️⃣ Updating course...');
      await api.put(`/private/v1/courses/${courseId}`, {
        description: 'Updated description for auto-reindex test'
      });
      console.log('✅ Course updated');

      // Wait for auto-reindex
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 5. Search again to see updated content
      console.log('5️⃣ Searching for updated course...');
      const updatedSearchResponse = await api.post('/agent/chat', {
        message: 'What is the description of Test Auto-Reindex Course?'
      });
      console.log('✅ Updated search result:', updatedSearchResponse.data.response);
      console.log();

      // 6. Clean up - delete the test course
      console.log('6️⃣ Cleaning up test course...');
      await api.delete(`/private/v1/courses/${courseId}`);
      console.log('✅ Test course deleted');

      // Wait for deletion auto-reindex
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 7. Verify course is removed from knowledge base
      console.log('7️⃣ Verifying course removal from knowledge base...');
      const deletedSearchResponse = await api.post('/agent/chat', {
        message: 'Tell me about Test Auto-Reindex Course'
      });
      console.log('✅ Search after deletion:', deletedSearchResponse.data.response);

    } catch (courseError) {
      console.error('❌ Course operations failed:', courseError.response?.data || courseError.message);

      // Try manual trigger as fallback test
      console.log('\n🔄 Testing manual trigger as fallback...');
      const manualResponse = await api.post('/agent/knowledge/auto-reindex/trigger', null, {
        params: {
          model: 'course',
          id: 'test-id',
          action: 'update'
        }
      });
      console.log('✅ Manual trigger:', manualResponse.data);
    }

    console.log('\n🎉 Auto-reindex test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  testAutoReindex().catch(console.error);
}

module.exports = { testAutoReindex };
