import { TimezoneCode } from '@prisma/client';
import { IsDateString, IsOptional } from 'class-validator';

export class MyScheduleQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}

export interface TeacherScheduleSlot {
  // ...existing code...
}

export interface StudentWeeklyScheduleDto {
  studentId: string;
  timezone: TimezoneCode;
  weekStart: string;
  weekEnd: string;
  days: StudentWeeklyScheduleDay[];
  summary: {
    totalSessions: number;
    byState: Record<string, number>;
  };
}

export interface StudentWeeklyScheduleDay {
  date: string;
  dayOfWeek: string;
  label: string;
  sessions: SessionListItem[];
}

export interface SessionListItem {
  id: string;
  classroomId: string;
  classroomName: string | null;
  courseTitle: string | null;
  startTime: string;
  endTime: string;
  durationHours: number;
  status: string;
  instructorName: string;
  roleContext?: {
    type: 'parent';
    childIds: string[];
  };
}
