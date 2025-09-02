import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';

class RegistrationTrendPoint {
  @ApiProperty()
  date: string;

  @ApiProperty()
  count: number;
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
}
