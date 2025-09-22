import axios from 'axios';

const API_BASE_URL = 'http://localhost:3334/api';

async function testCreateClassroom() {
  console.log('🧪 Testing Create Classroom API\n');

  const createClassroomPayload = {
    name: 'Lớp Tiếng Anh Cơ Bản',
    description: 'Lớp học tiếng Anh cho người mới bắt đầu',
    teacherId: '550e8400-e29b-41d4-a716-446655440000', // Mock teacher ID
    courseId: '550e8400-e29b-41d4-a716-446655440001',  // Mock course ID
    maxStudents: 25,
    isActive: true,
    periodStart: '2025-09-22T00:00:00.000Z', // Monday
    periodEnd: '2025-10-20T00:00:00.000Z',   // 4 weeks later
    slots: [
      {
        dayOfWeek: 'mon',
        startMinuteOfDay: 390, // 6:30 AM
        endMinuteOfDay: 480    // 8:00 AM (1.5 hours)
      },
      {
        dayOfWeek: 'sat',
        startMinuteOfDay: 450, // 7:30 AM
        endMinuteOfDay: 540    // 9:00 AM (1.5 hours)
      }
    ]
  };

  try {
    console.log('📤 Sending POST request to create classroom...');
    console.log('Payload:', JSON.stringify(createClassroomPayload, null, 2));

    const response = await axios.post(`${API_BASE_URL}/classrooms`, createClassroomPayload, {
      headers: {
        'Content-Type': 'application/json',
        // Add auth header if needed
        // 'Authorization': 'Bearer YOUR_JWT_TOKEN'
      }
    });

    console.log('\n✅ Classroom created successfully!');
    console.log('Response Status:', response.status);
    console.log('Created Classroom:', JSON.stringify(response.data, null, 2));

    // Verify calculations
    const { plannedHours, plannedSessions } = response.data;
    console.log('\n🧮 Calculation Verification:');
    console.log(`- Planned Hours: ${plannedHours} (expected: 12)`);
    console.log(`- Planned Sessions: ${plannedSessions} (expected: 8)`);

    if (plannedHours === 12 && plannedSessions === 8) {
      console.log('✅ Calculations are correct!');
    } else {
      console.log('❌ Calculations do not match expected values');
    }

    return response.data;

  } catch (error) {
    console.error('\n❌ Error creating classroom:');

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Network Error - No response received');
      console.error('Make sure the backend server is running on', API_BASE_URL);
    } else {
      console.error('Request Setup Error:', error.message);
    }

    return null;
  }
}

async function testGetClassroomDetail(classroomId: string) {
  try {
    console.log(`\n📤 Getting classroom detail for ID: ${classroomId}`);

    const response = await axios.get(`${API_BASE_URL}/classrooms/${classroomId}`);

    console.log('\n✅ Classroom detail retrieved:');
    console.log('Sessions count:', response.data.sessions?.length || 'No sessions data');
    console.log('Slots count:', response.data.slots?.length || 'No slots data');

    return response.data;

  } catch (error) {
    console.error('\n❌ Error getting classroom detail:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    return null;
  }
}

// Main test execution
async function main() {
  console.log('🚀 Starting Classroom API Tests\n');

  // Test 1: Create classroom
  const createdClassroom = await testCreateClassroom();

  if (createdClassroom?.id) {
    // Test 2: Get classroom detail
    await testGetClassroomDetail(createdClassroom.id);
  }

  console.log('\n🏁 Test completed!');
}

main().catch(console.error);
