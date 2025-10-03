import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestData() {
  try {
    // Tạo course có phí
    const paidCourse = await prisma.course.create({
      data: {
        title: 'Khóa học tiếng Anh giao tiếp có phí',
        description: 'Khóa học này yêu cầu thanh toán để truy cập',
        instructorId: '4319086b-68e7-4129-b3d7-b15c9a6c2934', // ID của user hiện tại
        price: 299000,
        currency: 'VND',
        isPublished: true,
        language: 'vi',
        totalLessons: 10,
        totalDuration: 600,
      },
    });

    console.log('Created paid course:', paidCourse.id);

    // Tạo classroom với paid course
    const paidClassroom = await prisma.classroom.create({
      data: {
        name: 'Lớp tiếng Anh có phí',
        description: 'Lớp học yêu cầu thanh toán học phí',
        courseId: paidCourse.id,
        teacherId: '4319086b-68e7-4129-b3d7-b15c9a6c2934',
        classCode: 'PAID001',
        maxStudents: 20,
        status: 'ongoing',
        periodStart: new Date('2025-09-01'),
        periodEnd: new Date('2025-12-31'),
        plannedHours: 40,
        plannedSessions: 20,
      },
    });

    console.log('Created paid classroom:', paidClassroom.id);

    // Thêm student vào classroom
    // isPurchased = true nếu course price <= 0, ngược lại false
    const coursePrice = 299000; // Giá course này
    await prisma.classroomStudent.create({
      data: {
        classroomId: paidClassroom.id,
        studentId: '4319086b-68e7-4129-b3d7-b15c9a6c2934', // Same user as test
        isPurchased: coursePrice <= 0, // Tự động true nếu miễn phí
        isActive: true,
      },
    });

    console.log('Added student to paid classroom (unpaid)');

  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

createTestData()
  .then(() => {
    console.log('Test data created successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to create test data:', error);
    process.exit(1);
  });
