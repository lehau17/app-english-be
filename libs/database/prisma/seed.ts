/* eslint-disable no-console */
import {
  AuthProvider,
  Gender,
  LanguageCode,
  PrismaClient,
  Status,
  TimezoneCode,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedTopics } from './seeds/topics.seed';

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

  // Create teacher2@gmail.com
  const teacher2 = await prisma.user.upsert({
    where: { email: 'teacher2@gmail.com' },
    update: {},
    create: {
      email: 'teacher2@gmail.com',
      passwordHash: password,
      role: UserRole.teacher,
      status: Status.active,
      firstName: 'Teacher',
      lastName: 'Two',
      displayName: 'Teacher Two',
      gender: Gender.female,
      language: LanguageCode.en,
      timezone: TimezoneCode.Asia_Ho_Chi_Minh,
      emailVerified: true,
      provider: AuthProvider.local,
    },
  });

  return { admin, student, parent, teacher2 };
}

async function main() {
  console.log('🌱 Seeding database...');
  const { admin, student, parent, teacher2 } = await seedUsers();
  console.log('Created users:');
  console.log('   - admin@gmail.com (Admin)');
  console.log('   - student@gmail.com (Student)');
  console.log('   - parent@gmail.com (Parent)');
  console.log('   - teacher2@gmail.com (Teacher)');
  console.log('   - Password for all: 123456aA@');

  await seedTopics();

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
