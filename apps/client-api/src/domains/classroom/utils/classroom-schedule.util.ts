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
  slots: CreateClassroomSlotDto[]
): ScheduleCalculation {
  const sessions: SessionEstimate[] = [];

  // Convert Weekday enum to numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
  const weekdayToNumber: Record<string, number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
  };

  // Get slot days as numbers
  const slotDays = slots.map(slot => ({
    dayNumber: weekdayToNumber[slot.dayOfWeek],
    ...slot
  }));

  // Iterate through each day in the period
  const currentDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  while (currentDate <= endDate) {
    const currentDayOfWeek = currentDate.getDay(); // 0=Sunday, 1=Monday, etc.

    // Find matching slot for this day
    const matchingSlot = slotDays.find(slot => slot.dayNumber === currentDayOfWeek);

    if (matchingSlot) {
      const durationMinutes = matchingSlot.endMinuteOfDay - matchingSlot.startMinuteOfDay;
      const durationHours = durationMinutes / 60;

      sessions.push({
        date: new Date(currentDate),
        dayOfWeek: matchingSlot.dayOfWeek as Weekday,
        startMinuteOfDay: matchingSlot.startMinuteOfDay,
        endMinuteOfDay: matchingSlot.endMinuteOfDay,
        durationHours
      });
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate totals
  const plannedSessions = sessions.length;
  const plannedHours = sessions.reduce((total, session) => total + session.durationHours, 0);

  return {
    plannedSessions,
    plannedHours,
    estimatedSessions: sessions
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
  const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));
  return hours * 60 + minutes;
}

/**
 * Generate ClassroomSession records from schedule calculation
 */
export function generateClassroomSessions(
  classroomId: string,
  instructorId: string,
  calculation: ScheduleCalculation,
  timezone: string = 'Asia/Ho_Chi_Minh'
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
      timezone: timezone as any, // Convert to TimezoneCode enum
      durationHours: session.durationHours,
      type: 'offline' as any, // Default type
      status: 'scheduled' as any,
      maxStudents: null,
      roomId: null,
      meetingUrl: null,
      location: null,
      agenda: null,
      materials: null,
      homework: null,
      notes: null,
      recordingUrl: null
    };
  });
}
