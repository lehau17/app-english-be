/* eslint-disable no-console */
import { ActivityType, AuthProvider, Gender, LanguageCode, PrismaClient, ProgressState, Status, TimezoneCode, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function seedUsers() {
    const password = await bcrypt.hash('P@ssw0rd!', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
            email: 'admin@example.com',
            username: 'admin',
            passwordHash: password,
            role: UserRole.admin,
            status: Status.active,
            firstName: 'System',
            lastName: 'Admin',
            language: LanguageCode.en,
            timezone: TimezoneCode.Asia_Ho_Chi_Minh,
            emailVerified: true,
            provider: AuthProvider.local,
        },
    });

    const teacher = await prisma.user.upsert({
        where: { email: 'teacher@example.com' },
        update: {},
        create: {
            email: 'teacher@example.com',
            username: 'teacher',
            passwordHash: password,
            role: UserRole.teacher,
            status: Status.active,
            firstName: 'Jane',
            lastName: 'Doe',
            language: LanguageCode.en,
            timezone: TimezoneCode.Asia_Ho_Chi_Minh,
            emailVerified: true,
            provider: AuthProvider.local,
        },
    });

    const students = await Promise.all(
        ['john', 'alexa', 'laurent'].map((name, idx) =>
            prisma.user.upsert({
                where: { email: `${name}@example.com` },
                update: {},
                create: {
                    email: `${name}@example.com`,
                    username: `${name}${idx + 1}`,
                    passwordHash: password,
                    role: UserRole.student,
                    status: Status.active,
                    firstName: name.charAt(0).toUpperCase() + name.slice(1),
                    lastName: idx === 0 ? 'Michael' : idx === 1 ? 'Liras' : 'Perrier',
                    gender: idx % 2 === 0 ? Gender.male : Gender.female,
                    language: LanguageCode.en,
                    timezone: TimezoneCode.Asia_Ho_Chi_Minh,
                    emailVerified: true,
                    provider: AuthProvider.local,
                    avatarUrl: `https://i.pravatar.cc/150?u=${name}`,
                    bio: idx === 0 ? 'Organization' : idx === 1 ? 'Developer' : 'Projects',
                },
            }),
        ),
    );

    return { admin, teacher, students };
}

type ActivitySeed = {
    type: ActivityType;
    orderNo: number;
    content: any;
};

function lessonActivities(lessonIndex: number): ActivitySeed[] {
    // sample JSON content per type
    return [
        {
            type: ActivityType.vocab,
            orderNo: 1,
            content: {
                cards: [
                    { word: 'cat', image: 'https://picsum.photos/seed/cat/200', audio: '', ipa: '/kæt/' },
                    { word: 'dog', image: 'https://picsum.photos/seed/dog/200', audio: '', ipa: '/dɔːɡ/' },
                ],
                instruction: 'Tap the correct picture',
            },
        },
        {
            type: ActivityType.listening,
            orderNo: 2,
            content: {
                items: [
                    { audio: '', choices: ['cat', 'dog', 'bird'], answerIndex: 1 },
                ],
                instruction: 'Choose what you hear',
            },
        },
        {
            type: ActivityType.mini_game,
            orderNo: 3,
            content: {
                game: 'match_pairs',
                pairs: [
                    ['cat', '🐱'],
                    ['dog', '🐶'],
                ],
            },
        },
    ];
}

async function seedCourse() {
    // Create course with ordered lessons & activities
    const course = await prisma.course.upsert({
        where: { orderNo: 1 },
        update: {},
        create: {
            title: 'English Basics',
            description: 'Foundation course with simple vocab & listening',
            orderNo: 1,
        },
    });

    // Lessons
    const lessons = [
        { title: 'Animals', description: 'Learn animal words' },
        { title: 'Colors', description: 'Basic colors' },
        { title: 'Numbers', description: '1 to 10' },
    ];

    for (let i = 0; i < lessons.length; i++) {
        const l = lessons[i];
        const lesson = await prisma.lesson.upsert({
            where: {
                // composite unique is (courseId, orderNo) → need unique id to upsert
                // so we do a findFirst + create/update
                id: (await (async () => {
                    const existed = await prisma.lesson.findFirst({
                        where: { courseId: course.id, orderNo: i + 1 },
                    });
                    return existed?.id || uuidv4();
                })()),
            },
            update: {
                title: l.title,
                description: l.description,
                courseId: course.id,
                orderNo: i + 1,
            },
            create: {
                id: uuidv4(),
                title: l.title,
                description: l.description,
                courseId: course.id,
                orderNo: i + 1,
            },
        });

        // Activities per lesson
        const acts = lessonActivities(i + 1);
        for (const a of acts) {
            // ensure unique (lessonId, orderNo)
            const existing = await prisma.activity.findFirst({
                where: { lessonId: lesson.id, orderNo: a.orderNo },
            });
            if (!existing) {
                await prisma.activity.create({
                    data: {
                        lessonId: lesson.id,
                        type: a.type,
                        orderNo: a.orderNo,
                        content: a.content,
                    },
                });
            }
        }
    }

    return course;
}

async function seedProgressForFirstStudent(firstStudentId: string) {
    // pick first lesson activities → create Progress not_started
    const firstLesson = await prisma.lesson.findFirst({
        where: { orderNo: 1 },
        include: { activities: { orderBy: { orderNo: 'asc' } } },
    });
    if (!firstLesson) return;

    for (const act of firstLesson.activities) {
        await prisma.progress.upsert({
            where: {
                // composite unique (userId, activityId) is not available in upsert
                // use id workaround:
                id: `${firstStudentId}-${act.id}`.slice(0, 36), // not ideal, but we’ll fallback to find/create
            },
            update: {},
            create: {
                id: uuidv4(),
                userId: firstStudentId,
                activityId: act.id,
                state: ProgressState.not_started,
                timeSpentSec: 0,
            },
        }).catch(async () => {
            // fallback: respect @@unique([userId, activityId])
            const existed = await prisma.progress.findUnique({
                where: { userId_activityId: { userId: firstStudentId, activityId: act.id } },
            }).catch(() => null as any);
            if (!existed) {
                await prisma.progress.create({
                    data: {
                        userId: firstStudentId,
                        activityId: act.id,
                        state: ProgressState.not_started,
                        timeSpentSec: 0,
                    },
                });
            }
        });
    }
}

async function main() {
    console.log('🌱 Seeding...');
    const { students } = await seedUsers();
    const course = await seedCourse();
    if (students.length) {
        await seedProgressForFirstStudent(students[0].id);
    }
    console.log('✅ Seed done. Course:', course.title);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
