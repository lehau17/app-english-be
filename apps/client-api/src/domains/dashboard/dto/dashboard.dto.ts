import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';

class RegistrationTrendPoint {
  @ApiProperty()
  date: string;

  @ApiProperty()
  count: number;
}

class CourseDistributionPoint {
  @ApiProperty()
  label: string;

  @ApiProperty()
  value: number;
}

class UpcomingClassItem {
  @ApiProperty()
  id: string;

  @ApiProperty()
  classroomName: string;

  @ApiProperty({ required: false })
  courseTitle?: string;

  @ApiProperty()
  teacherName: string;

  @ApiProperty()
  startTime: string;

  @ApiProperty()
  endTime: string;

  @ApiProperty({ required: false })
  roomName?: string | null;

  @ApiProperty()
  activeStudents: number;

  @ApiProperty({ required: false })
  maxStudents?: number | null;
}

class DashboardNotificationItem {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  message?: string | null;

  @ApiProperty({ enum: ['success', 'warning', 'error', 'info'] })
  type: 'success' | 'warning' | 'error' | 'info';

  @ApiProperty()
  createdAt: string;
}

export class DashboardDto {
  @ApiProperty()
  totalStudents: number;

  @ApiProperty()
  totalCourses: number;

  @ApiProperty()
  totalLessons: number;

  @ApiProperty()
  totalActivities: number;

  @ApiProperty({ type: () => 'User' }) // Use a string to avoid circular dependency issues if User DTO is complex
  recentStudents: Partial<User>[];

  @ApiProperty({ type: [RegistrationTrendPoint] })
  registrationTrend: RegistrationTrendPoint[];

  @ApiProperty({ type: [CourseDistributionPoint] })
  courseDistribution: CourseDistributionPoint[];

  @ApiProperty({ type: [UpcomingClassItem] })
  upcomingClasses: UpcomingClassItem[];

  @ApiProperty({ type: [DashboardNotificationItem] })
  notifications: DashboardNotificationItem[];

  static defaultValueResponse(): DashboardDto {
    return {
      totalStudents: 0,
      totalCourses: 0,
      totalLessons: 0,
      totalActivities: 0,
      recentStudents: [],
      registrationTrend: [],
      courseDistribution: [],
      upcomingClasses: [],
      notifications: [],
    } as DashboardDto;
  }
}
