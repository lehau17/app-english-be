#!/usr/bin/env ts-node
/**
 * Script to check landing page data in database
 * Run: npx ts-node scripts/check-landing-data.ts
 */

import { PrismaClient, UserRole, ClassroomStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLandingData() {
  console.log('\n🔍 Checking Landing Page Data in Database...\n');
  console.log('='.repeat(60));

  try {
    // 1. Check Teachers
    console.log('\n📚 TEACHERS:');
    const teachers = await prisma.user.findMany({
      where: { role: UserRole.teacher },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
        nationality: true,
        experience: true,
        highlights: true,
      },
      take: 10,
    });

    if (teachers.length === 0) {
      console.log('❌ NO TEACHERS FOUND IN DATABASE');
      console.log('   → Backend will use FALLBACK_TEACHERS (fake data)');
    } else {
      console.log(`✅ Found ${teachers.length} teachers:`);
      teachers.forEach((t, i) => {
        const name = t.displayName || `${t.firstName} ${t.lastName}`.trim() || 'N/A';
        console.log(`   ${i + 1}. ${name} (${t.nationality || 'No nationality'}) - ${t.experience || 0} years`);
      });
    }

    // 2. Check Published Courses
    console.log('\n📖 PUBLISHED COURSES:');
    const publishedCourses = await prisma.course.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        difficulty: true,
        price: true,
        instructorId: true,
      },
      take: 10,
    });

    if (publishedCourses.length === 0) {
      console.log('❌ NO PUBLISHED COURSES FOUND');
      console.log('   → Backend will use FALLBACK_CLASSES (fake data)');
      console.log('   → Fix: Update courses to set isPublished = true');
    } else {
      console.log(`✅ Found ${publishedCourses.length} published courses:`);
      publishedCourses.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.title} (${c.difficulty}) - ${c.price || 0} VND`);
      });
    }

    // 3. Check Active Classrooms
    console.log('\n🏫 ACTIVE CLASSROOMS:');
    const classrooms = await prisma.classroom.findMany({
      where: {
        isActive: true,
        status: {
          in: [ClassroomStatus.upcoming, ClassroomStatus.ongoing],
        },
      },
      include: {
        teacher: {
          select: {
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        course: {
          select: {
            title: true,
            isPublished: true,
          },
        },
        students: {
          where: { isActive: true },
          select: { studentId: true },
        },
        slots: {
          select: {
            dayOfWeek: true,
            startMinuteOfDay: true,
            endMinuteOfDay: true,
          },
        },
      },
      take: 10,
    });

    if (classrooms.length === 0) {
      console.log('❌ NO ACTIVE CLASSROOMS FOUND');
      console.log('   → Need classrooms with:');
      console.log('      - isActive = true');
      console.log('      - status = upcoming OR ongoing');
      console.log('      - linked to published courses');
    } else {
      console.log(`✅ Found ${classrooms.length} active classrooms:`);
      classrooms.forEach((cl, i) => {
        const teacherName = cl.teacher
          ? cl.teacher.displayName || `${cl.teacher.firstName} ${cl.teacher.lastName}`.trim()
          : 'No teacher';
        const coursePublished = cl.course?.isPublished ? '✓' : '✗';
        const hasSlots = cl.slots && cl.slots.length > 0;
        console.log(
          `   ${i + 1}. ${cl.name} - ${teacherName} (Course published: ${coursePublished}) - ${cl.students.length}/${cl.maxStudents || '∞'} students`
        );
        if (hasSlots) {
          console.log(`      ✓ Has ${cl.slots.length} schedule slot(s)`);
          cl.slots.forEach((slot) => {
            const startTime = `${Math.floor(slot.startMinuteOfDay / 60)}:${(slot.startMinuteOfDay % 60).toString().padStart(2, '0')}`;
            const endTime = `${Math.floor(slot.endMinuteOfDay / 60)}:${(slot.endMinuteOfDay % 60).toString().padStart(2, '0')}`;
            console.log(`         - ${slot.dayOfWeek}: ${startTime}-${endTime}`);
          });
        } else {
          console.log(`      ✗ NO SCHEDULE SLOTS → Will use FALLBACK_SCHEDULE`);
        }
      });
    }

    // 4. Check Course Ratings (for testimonials)
    console.log('\n⭐ COURSE RATINGS (for testimonials):');
    const ratings = await prisma.courseRating.findMany({
      where: { comment: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        rating: true,
        comment: true,
        userId: true,
      },
    });

    if (ratings.length === 0) {
      console.log('❌ NO RATINGS WITH COMMENTS FOUND');
      console.log('   → Backend will use FALLBACK_TESTIMONIALS (fake data)');
    } else {
      console.log(`✅ Found ${ratings.length} ratings with comments:`);
      const userIds = ratings.map(r => r.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });
      const userMap = new Map(users.map(u => [u.id, u]));
      
      ratings.forEach((r, i) => {
        const user = userMap.get(r.userId);
        const userName = user
          ? user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous'
          : 'Anonymous';
        const userRole = user?.role || 'unknown';
        console.log(`   ${i + 1}. ${userName} (${userRole}) - ${r.rating}★: ${r.comment?.substring(0, 50)}...`);
      });
    }

    // 5. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(60));

    const issues: string[] = [];
    if (teachers.length === 0) {
      issues.push('❌ No teachers → Using FALLBACK_TEACHERS');
    }
    if (publishedCourses.length === 0) {
      issues.push('❌ No published courses → Using FALLBACK_CLASSES');
    }
    if (classrooms.length === 0) {
      issues.push('❌ No active classrooms → Using FALLBACK_SCHEDULE');
    } else {
      const classroomsWithoutSlots = classrooms.filter(cl => !cl.slots || cl.slots.length === 0);
      if (classroomsWithoutSlots.length > 0) {
        issues.push(`⚠️  ${classroomsWithoutSlots.length}/${classrooms.length} classrooms have NO SCHEDULE SLOTS → Will use FALLBACK_SCHEDULE`);
      }
    }
    if (ratings.length === 0) {
      issues.push('❌ No ratings → Using FALLBACK_TESTIMONIALS');
    }

    if (issues.length > 0) {
      console.log('\n🔴 ISSUES FOUND:');
      issues.forEach((issue) => console.log(`   ${issue}`));
      console.log('\n💡 TO FIX:');
      console.log('   1. Create teacher accounts (role = teacher)');
      console.log('   2. Set courses isPublished = true');
      console.log('   3. Create classrooms with status = upcoming/ongoing');
      console.log('   4. Assign teachers to classrooms');
      console.log('   5. CREATE SCHEDULE SLOTS for classrooms (ClassroomScheduleSlot table)');
      console.log('      Example: mon/wed/fri 19:00-21:00 (1140-1260 minutes)');
      console.log('   6. Add course ratings with comments');
    } else {
      console.log('\n✅ ALL DATA LOOKS GOOD! Landing page should show real data.');
    }

    console.log('\n' + '='.repeat(60));
  } catch (error) {
    console.error('❌ Error checking data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLandingData();
