const axios = require('axios');

const API_BASE_URL = 'http://localhost:3334/api';

async function testAutoExamCreation() {
    console.log('🧪 Testing Auto Exam Creation Feature\n');

    try {
        // 1. Tạo classroom với course có 8 buổi học
        const createClassroomPayload = {
            name: 'Test Class - Auto Exam Creation',
            description: 'Lớp test để kiểm tra tính năng tự động tạo bài thi',
            courseId: 'course-1', // Thay bằng course ID thực tế
            teacherId: 'teacher-1', // Thay bằng teacher ID thực tế
            periodStart: new Date('2024-01-15'),
            periodEnd: new Date('2024-03-15'),
            autoCalculateDates: true,
            slots: [
                {
                    dayOfWeek: 1, // Monday
                    startTime: '09:00',
                    endTime: '10:30',
                    timezone: 'Asia/Ho_Chi_Minh'
                },
                {
                    dayOfWeek: 3, // Wednesday
                    startTime: '09:00',
                    endTime: '10:30',
                    timezone: 'Asia/Ho_Chi_Minh'
                }
            ]
        };

        console.log('📤 Creating classroom with auto exam creation...');
        console.log('Payload:', JSON.stringify(createClassroomPayload, null, 2));

        const classroomResponse = await axios.post(`${API_BASE_URL}/classrooms`, createClassroomPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_JWT_TOKEN' // Thay bằng token thực tế
            }
        });

        if (classroomResponse.status === 201) {
            console.log('\n✅ Classroom created successfully!');
            const classroom = classroomResponse.data;
            console.log('Created Classroom:', JSON.stringify(classroom, null, 2));

            // 2. Kiểm tra xem có bài thi nào được tạo tự động không
            console.log('\n🔍 Checking for auto-created exams...');

            const assignmentsResponse = await axios.get(`${API_BASE_URL}/classrooms/${classroom.id}/assignments`, {
                headers: {
                    'Authorization': 'Bearer YOUR_JWT_TOKEN'
                }
            });

            if (assignmentsResponse.status === 200) {
                const assignments = assignmentsResponse.data;
                console.log(`\n📋 Found ${assignments.length} assignments in classroom`);

                // Tìm bài thi giữa kỳ và cuối kỳ
                const midtermExam = assignments.find(a => a.type === 'MIDTERM_EXAM');
                const finalExam = assignments.find(a => a.type === 'FINAL_EXAM');

                if (midtermExam) {
                    console.log('\n🎯 Midterm Exam Found:');
                    console.log(`- Title: ${midtermExam.title}`);
                    console.log(`- Due Date: ${midtermExam.dueDate}`);
                    console.log(`- Total Points: ${midtermExam.totalPoints}`);
                    console.log(`- Time Limit: ${midtermExam.timeLimit} minutes`);
                    console.log(`- Max Attempts: ${midtermExam.maxAttempts}`);
                    console.log(`- Activities Count: ${midtermExam.assignmentActivities?.length || 0}`);
                } else {
                    console.log('\n❌ Midterm Exam NOT found!');
                }

                if (finalExam) {
                    console.log('\n🎯 Final Exam Found:');
                    console.log(`- Title: ${finalExam.title}`);
                    console.log(`- Due Date: ${finalExam.dueDate}`);
                    console.log(`- Total Points: ${finalExam.totalPoints}`);
                    console.log(`- Time Limit: ${finalExam.timeLimit} minutes`);
                    console.log(`- Max Attempts: ${finalExam.maxAttempts}`);
                    console.log(`- Activities Count: ${finalExam.assignmentActivities?.length || 0}`);
                } else {
                    console.log('\n❌ Final Exam NOT found!');
                }

                // 3. Kiểm tra thời gian tạo bài thi
                if (midtermExam && finalExam) {
                    const periodStart = new Date(createClassroomPayload.periodStart);
                    const periodEnd = new Date(createClassroomPayload.periodEnd);
                    const periodDuration = periodEnd.getTime() - periodStart.getTime();

                    const expectedMidtermDate = new Date(periodStart.getTime() + (periodDuration * 0.4));
                    const expectedFinalDate = new Date(periodStart.getTime() + (periodDuration * 0.8));

                    const actualMidtermDate = new Date(midtermExam.dueDate);
                    const actualFinalDate = new Date(finalExam.dueDate);

                    console.log('\n📅 Date Verification:');
                    console.log(`Expected Midterm Date: ${expectedMidtermDate.toISOString()}`);
                    console.log(`Actual Midterm Date: ${actualMidtermDate.toISOString()}`);
                    console.log(`Expected Final Date: ${expectedFinalDate.toISOString()}`);
                    console.log(`Actual Final Date: ${actualFinalDate.toISOString()}`);

                    const midtermDateDiff = Math.abs(actualMidtermDate.getTime() - expectedMidtermDate.getTime());
                    const finalDateDiff = Math.abs(actualFinalDate.getTime() - expectedFinalDate.getTime());

                    if (midtermDateDiff < 24 * 60 * 60 * 1000) { // Within 1 day
                        console.log('✅ Midterm exam date is correct!');
                    } else {
                        console.log('❌ Midterm exam date is incorrect!');
                    }

                    if (finalDateDiff < 24 * 60 * 60 * 1000) { // Within 1 day
                        console.log('✅ Final exam date is correct!');
                    } else {
                        console.log('❌ Final exam date is incorrect!');
                    }
                }

                // 4. Kiểm tra chi tiết activities của bài thi
                if (midtermExam && midtermExam.assignmentActivities) {
                    console.log('\n📝 Midterm Exam Activities:');
                    midtermExam.assignmentActivities.forEach((activity, index) => {
                        console.log(`  ${index + 1}. ${activity.title} (${activity.points} points) - ${activity.type}`);
                    });
                }

                if (finalExam && finalExam.assignmentActivities) {
                    console.log('\n📝 Final Exam Activities:');
                    finalExam.assignmentActivities.forEach((activity, index) => {
                        console.log(`  ${index + 1}. ${activity.title} (${activity.points} points) - ${activity.type}`);
                    });
                }

                console.log('\n🎉 Auto Exam Creation Test Completed!');

                if (midtermExam && finalExam) {
                    console.log('✅ SUCCESS: Both midterm and final exams were created automatically!');
                } else {
                    console.log('❌ FAILED: Auto exam creation did not work as expected!');
                }

            } else {
                console.log('❌ Failed to fetch assignments');
            }

        } else {
            console.log('❌ Failed to create classroom');
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.response?.data || error.message);
    }
}

// Chạy test
testAutoExamCreation();

