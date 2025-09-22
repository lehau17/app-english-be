export interface TeacherScheduleSlot {
  dayOfWeek: string; // 'mon', 'tue', etc.
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  classroomId: string;
  classroomName: string;
  status: 'occupied' | 'available';
}

export interface TeacherWeeklySchedule {
  teacherId: string;
  teacherName: string;
  weekStart: Date;
  weekEnd: Date;
  schedule: {
    [dayOfWeek: string]: TeacherScheduleSlot[];
  };
}
