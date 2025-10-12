/* eslint-disable no-console */
import { AuthProvider, Gender, LanguageCode, PrismaClient, Status, TimezoneCode, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedUsers() {
    // Hash password "123456aA@" with bcrypt
    const password = await bcrypt.hash('123456aA@', 10);

    // Create admin@gmail.com
    const admin = await prisma.user.upsert({
        where: { email: 'admin@gmail.com' },
        update: {},
        create: {
            email: 'admin@gmail.com',
            passwordHash: password,
            role: UserRole.admin,
            status: Status.active,
            firstName: 'Admin',
            lastName: 'User',
            displayName: 'Admin User',
            language: LanguageCode.en,
            timezone: TimezoneCode.Asia_Ho_Chi_Minh,
            emailVerified: true,
            provider: AuthProvider.local,
        },
    });

    // Create student@gmail.com
    const student = await prisma.user.upsert({
        where: { email: 'student@gmail.com' },
        update: {},
        create: {
            email: 'student@gmail.com',
            passwordHash: password,
            role: UserRole.student,
            status: Status.active,
            firstName: 'Student',
            lastName: 'User',
            displayName: 'Student User',
            gender: Gender.male,
            language: LanguageCode.en,
            timezone: TimezoneCode.Asia_Ho_Chi_Minh,
            emailVerified: true,
            provider: AuthProvider.local,
        },
    });

    // Create parent@gmail.com
    const parent = await prisma.user.upsert({
        where: { email: 'parent@gmail.com' },
        update: {},
        create: {
            email: 'parent@gmail.com',
            passwordHash: password,
            role: UserRole.parent,
            status: Status.active,
            firstName: 'Parent',
            lastName: 'User',
            displayName: 'Parent User',
            language: LanguageCode.en,
            timezone: TimezoneCode.Asia_Ho_Chi_Minh,
            emailVerified: true,
            provider: AuthProvider.local,
        },
    });

    return { admin, student, parent };
}

async function main() {
    console.log('🌱 Seeding database...');
    const { admin, student, parent } = await seedUsers();
    console.log('✅ Created users:');
    console.log('   - admin@gmail.com (Admin)');
    console.log('   - student@gmail.com (Student)');
    console.log('   - parent@gmail.com (Parent)');
    console.log('   - Password for all: 123456aA@');
    console.log('✅ Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

// async function seedCourse() {
//     // Create course with ordered lessons & activities
//     const course = await prisma.course.upsert({
//         where: { orderNo: 1 },
//         update: {},
//         create: {
//             title: 'English Basics',
//             description: 'Foundation course with simple vocab & listening',
//             orderNo: 1,
//         },
//     });

//     // Lessons
//     const lessons = [
//         { title: 'Animals', description: 'Learn animal words' },
//         { title: 'Colors', description: 'Basic colors' },
//         { title: 'Numbers', description: '1 to 10' },
//     ];

//     for (let i = 0; i < lessons.length; i++) {
//         const l = lessons[i];
//         const lesson = await prisma.lesson.upsert({
//             where: {
//                 // composite unique is (courseId, orderNo) → need unique id to upsert
//                 // so we do a findFirst + create/update
//                 id: (await (async () => {
//                     const existed = await prisma.lesson.findFirst({
//                         where: { courseId: course.id, orderNo: i + 1 },
//                     });
//                     return existed?.id || uuidv4();
//                 })()),
//             },
//             update: {
//                 title: l.title,
//                 description: l.description,
//                 courseId: course.id,
//                 orderNo: i + 1,
//             },
//             create: {
//                 id: uuidv4(),
//                 title: l.title,
//                 description: l.description,
//                 courseId: course.id,
//                 orderNo: i + 1,
//             },
//         });

//         // Activities per lesson
//         const acts = lessonActivities(i + 1);
//         // for (const a of acts) {
//         //     // ensure unique (lessonId, orderNo)
//         //     const existing = await prisma.activity.findFirst({
//         //         where: { lessonId: lesson.id, orderNo: a.orderNo },
//         //     });
//         //     if (!existing) {
//         //         await prisma.activity.create({
//         //             data: {
//         //                 lessonId: lesson.id,
//         //                 type: a.type,
//         //                 orderNo: a.orderNo,
//         //                 content: a.content,
//         //             },
//         //         });
//         //     }
//         // }
//     }

//     return course;
// }

// async function seedProgressForFirstStudent(firstStudentId: string) {
//     // pick first lesson activities → create Progress not_started
//     const firstLesson = await prisma.lesson.findFirst({
//         where: { orderNo: 1 },
//         include: { activities: { orderBy: { orderNo: 'asc' } } },
//     });
//     if (!firstLesson) return;

//     for (const act of firstLesson.activities) {
//         await prisma.progress.upsert({
//             where: {
//                 // composite unique (userId, activityId) is not available in upsert
//                 // use id workaround:
//                 id: `${firstStudentId}-${act.id}`.slice(0, 36), // not ideal, but we’ll fallback to find/create
//             },
//             update: {},
//             create: {
//                 id: uuidv4(),
//                 userId: firstStudentId,
//                 activityId: act.id,
//                 state: ProgressState.not_started,
//                 timeSpentSec: 0,
//             },
//         }).catch(async () => {
//             // fallback: respect @@unique([userId, activityId])
//             const existed = await prisma.progress.findUnique({
//                 where: { userId_activityId: { userId: firstStudentId, activityId: act.id } },
//             }).catch(() => null as any);
//             if (!existed) {
//                 await prisma.progress.create({
//                     data: {
//                         userId: firstStudentId,
//                         activityId: act.id,
//                         state: ProgressState.not_started,
//                         timeSpentSec: 0,
//                     },
//                 });
//             }
//         });
//     }
// }

// async function main() {
//     console.log('🌱 Seeding...');
//     const { students } = await seedUsers();
//     const course = await seedCourse();
//     if (students.length) {
//         await seedProgressForFirstStudent(students[0].id);
//     }
//     console.log('✅ Seed done. Course:', course.title);
// }

// main()
//     .catch((e) => {
//         console.error('❌ Seed failed:', e);
//         process.exit(1);
//     })
//     .finally(async () => {
//         await prisma.$disconnect();
//     });
