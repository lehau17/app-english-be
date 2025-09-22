import { calculateClassroomSchedule, minutesToTimeString } from './apps/client-api/src/domains/classroom/utils/classroom-schedule.util';

enum Weekday {
  mon = 'mon',
  tue = 'tue',
  wed = 'wed',
  thu = 'thu',
  fri = 'fri',
  sat = 'sat',
  sun = 'sun'
}

interface CreateClassroomSlotDto {
  dayOfWeek: Weekday;
  startMinuteOfDay: number;
  endMinuteOfDay: number;
}

console.log('🧪 Testing Classroom Schedule Calculation\n');

// Test case 1: Mon 6:30-8:00, Sat 7:30-9:00 for 4 weeks
const testSlots1: CreateClassroomSlotDto[] = [
  {
    dayOfWeek: Weekday.mon,
    startMinuteOfDay: 390, // 6:30
    endMinuteOfDay: 480    // 8:00
  },
  {
    dayOfWeek: Weekday.sat,
    startMinuteOfDay: 450, // 7:30
    endMinuteOfDay: 540    // 9:00
  }
];

const periodStart1 = new Date('2025-09-22'); // Monday
const periodEnd1 = new Date('2025-10-19');   // Sunday (4 weeks)

console.log('📅 Test 1: 4 weeks, Mon 6:30-8:00 + Sat 7:30-9:00');
console.log(`Period: ${periodStart1.toDateString()} -> ${periodEnd1.toDateString()}`);

const result1 = calculateClassroomSchedule(periodStart1, periodEnd1, testSlots1);

console.log(`\n✅ Results:`);
console.log(`- Planned Sessions: ${result1.plannedSessions}`);
console.log(`- Planned Hours: ${result1.plannedHours}`);
console.log(`\n📝 Session Details:`);

result1.estimatedSessions.forEach((session, index) => {
  console.log(`  ${index + 1}. ${session.date.toDateString()} (${session.dayOfWeek}) ${minutesToTimeString(session.startMinuteOfDay)}-${minutesToTimeString(session.endMinuteOfDay)} (${session.durationHours}h)`);
});

console.log('\n' + '='.repeat(60) + '\n');

// Test case 2: Tue-Thu-Sat for 6 weeks
const testSlots2: CreateClassroomSlotDto[] = [
  {
    dayOfWeek: Weekday.tue,
    startMinuteOfDay: 600, // 10:00
    endMinuteOfDay: 690    // 11:30
  },
  {
    dayOfWeek: Weekday.thu,
    startMinuteOfDay: 600, // 10:00
    endMinuteOfDay: 690    // 11:30
  },
  {
    dayOfWeek: Weekday.sat,
    startMinuteOfDay: 540, // 9:00
    endMinuteOfDay: 660    // 11:00
  }
];

const periodStart2 = new Date('2025-09-23'); // Tuesday
const periodEnd2 = new Date('2025-11-04');   // Tuesday (6+ weeks)

console.log('📅 Test 2: 6+ weeks, Tue+Thu 10:00-11:30 + Sat 9:00-11:00');
console.log(`Period: ${periodStart2.toDateString()} -> ${periodEnd2.toDateString()}`);

const result2 = calculateClassroomSchedule(periodStart2, periodEnd2, testSlots2);

console.log(`\n✅ Results:`);
console.log(`- Planned Sessions: ${result2.plannedSessions}`);
console.log(`- Planned Hours: ${result2.plannedHours}`);

const weeklyHours = testSlots2.reduce((total, slot) => {
  const duration = (slot.endMinuteOfDay - slot.startMinuteOfDay) / 60;
  return total + duration;
}, 0);

console.log(`- Weekly Hours: ${weeklyHours}`);
console.log(`- Weeks Covered: ${(result2.plannedHours / weeklyHours).toFixed(1)}`);

console.log(`\n📝 First 5 sessions:`);
result2.estimatedSessions.slice(0, 5).forEach((session, index) => {
  console.log(`  ${index + 1}. ${session.date.toDateString()} (${session.dayOfWeek}) ${minutesToTimeString(session.startMinuteOfDay)}-${minutesToTimeString(session.endMinuteOfDay)} (${session.durationHours}h)`);
});

if (result2.estimatedSessions.length > 5) {
  console.log(`  ... and ${result2.estimatedSessions.length - 5} more sessions`);
}

console.log('\n🎉 Test completed successfully!');
