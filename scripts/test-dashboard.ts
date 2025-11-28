import axios from 'axios';

// Test script để kiểm tra dashboard API
async function testDashboardAPI() {
  try {
    console.log('🧪 Testing Dashboard API...');

    // Thay thế bằng token thật của bạn
    const token = 'your-jwt-token-here';

    const response = await axios.get('http://localhost:3000/api/private/v1/student-dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Dashboard API Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Kiểm tra cấu trúc response
    const { xp, level, coins, streak, dailyQuests, leaderboard } = response.data;

    console.log('\nDashboard Summary:');
    console.log(`XP: ${xp}, Level: ${level}, Coins: ${coins}, Streak: ${streak} days`);
    console.log(`Daily Quests: ${dailyQuests.length}`);
    console.log(`Leaderboard entries: ${leaderboard.length}`);

    if (dailyQuests.length > 0) {
      console.log('\nSample Daily Quest:');
      console.log(dailyQuests[0]);
    }

  } catch (error) {
    console.error('API Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Chạy test
testDashboardAPI();
