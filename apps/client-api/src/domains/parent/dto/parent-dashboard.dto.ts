import { ApiProperty } from '@nestjs/swagger';

class ChildProgressDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  avatar?: string;

  @ApiProperty()
  level: number;

  @ApiProperty()
  todayStudyTime: number;

  @ApiProperty()
  completedActivities: number;

  @ApiProperty()
  totalActivities: number;

  @ApiProperty()
  recentActivity: string;

  @ApiProperty()
  lastActive: string;
}

class ParentRewardDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  type: string;

  @ApiProperty({ required: false })
  imageUrl?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  claimsCount: number;

  @ApiProperty()
  createdAt: Date;
}

class ParentNotificationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ required: false })
  data?: any;

  @ApiProperty({ required: false })
  readAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class ParentDashboardDto {
  @ApiProperty({ type: [ChildProgressDto] })
  children: ChildProgressDto[];

  @ApiProperty({ type: [ParentRewardDto] })
  rewards: ParentRewardDto[];

  @ApiProperty({ type: [ParentNotificationDto] })
  notifications: ParentNotificationDto[];

  @ApiProperty()
  totalStudyTime: number;

  @ApiProperty()
  completionRate: number;

  static defaultValueResponse() {
    return {
      children: [],
      rewards: [],
      notifications: [],
      totalStudyTime: 0,
      completionRate: 0,
    };
  }
}
