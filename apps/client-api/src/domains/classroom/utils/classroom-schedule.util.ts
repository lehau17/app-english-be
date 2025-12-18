import { Weekday } from '@prisma/client';
import { CreateClassroomSlotDto } from '../dto/classroom.dto';

export interface ScheduleCalculation {
  plannedSessions: number;
  plannedHours: number;
  estimatedSessions: SessionEstimate[];
}

export interface SessionEstimate {
  date: Date;
  dayOfWeek: Weekday;
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  durationHours: number;
}

/**
 * Tính toán số buổi học và tổng giờ học dựa trên:
 * - Khoảng thời gian (periodStart -> periodEnd)
 * - Các slots trong tuần (dayOfWeek + time range)
 */
export function calculateClassroomSchedule(
  periodStart: Date,
  periodEnd: Date,
  slots: CreateClassroomSlotDto[],
  holidayDates: string[] = [],
): ScheduleCalculation {
  const sessions: SessionEstimate[] = [];

  if (!slots?.length) {
    return {
      plannedSessions: 0,
      plannedHours: 0,
      estimatedSessions: [],
    };
  }

  const weekdayToNumber: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  const slotsByDay = slots.reduce<Record<number, CreateClassroomSlotDto[]>>(
    (acc, slot) => {
      const dayNumber = weekdayToNumber[slot.dayOfWeek];
      if (typeof dayNumber !== 'number') return acc;
      if (!acc[dayNumber]) acc[dayNumber] = [];
      acc[dayNumber].push(slot);
      return acc;
    },
    {},
  );

  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  for (
    const cursor = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    );
    cursor <= end;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    // Check if current date is holiday
    const dateString = cursor.toISOString().split('T')[0];
    if (holidayDates.includes(dateString)) continue;

    const daySlots = slotsByDay[cursor.getDay()] || [];

    for (const slot of daySlots) {
      if (slot.endMinuteOfDay <= slot.startMinuteOfDay) continue; // skip invalid slot

      const durationHours = (slot.endMinuteOfDay - slot.startMinuteOfDay) / 60;

      sessions.push({
        date: new Date(cursor),
        dayOfWeek: slot.dayOfWeek as Weekday,
        startMinuteOfDay: slot.startMinuteOfDay,
        endMinuteOfDay: slot.endMinuteOfDay,
        durationHours,
      });
    }
  }

  const plannedSessions = sessions.length;
  const plannedHours = sessions.reduce(
    (total, session) => total + session.durationHours,
    0,
  );

  return {
    plannedSessions,
    plannedHours,
    estimatedSessions: sessions,
  };
}

/**
 * Convert minutes from 00:00 to HH:MM format
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Convert HH:MM time string to minutes from 00:00
 */
export function timeStringToMinutes(timeString: string): number {
  const [hours, minutes] = timeString
    .split(':')
    .map((num) => parseInt(num, 10));
  return hours * 60 + minutes;
}

/**
 * Generate ClassroomSession records from schedule calculation
 */
export function generateClassroomSessions(
  classroomId: string,
  instructorId: string,
  calculation: ScheduleCalculation,
  timezone: string = 'Asia_Ho_Chi_Minh',
) {
  return calculation.estimatedSessions.map((session, index) => {
    // Create start and end DateTime by adding minutes to date
    const startTime = new Date(session.date);
    startTime.setHours(0, session.startMinuteOfDay, 0, 0);

    const endTime = new Date(session.date);
    endTime.setHours(0, session.endMinuteOfDay, 0, 0);

    return {
      classroomId,
      instructorId,
      title: `Session ${index + 1}`,
      description: `Weekly ${session.dayOfWeek} session`,
      startTime,
      endTime,
      timezone: normaliseTimezone(timezone),
      durationHours: session.durationHours,
      type: 'offline' as any, // Default type
      status: 'scheduled' as any,
      meetingUrl: null,
      agenda: null,
      materials: null,
      notes: null,
      recordingUrl: null,
    };
  });
}

function normaliseTimezone(tz: string): any {
  if (!tz) return 'Asia_Ho_Chi_Minh';
  const cleaned = tz.replace('/', '_');
  return cleaned as any;
}
