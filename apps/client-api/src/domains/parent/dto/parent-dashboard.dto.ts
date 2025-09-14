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
  xp: number;

  @ApiProperty()
  xpToNext: number;

  @ApiProperty()
  streak: number;

  @ApiProperty()
  coins: number;

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
  cost: number;

  @ApiProperty()
  claimed: boolean;
}

class ParentNotificationDto {
  @ApiProperty()
  type: 'achievement' | 'activity' | 'reminder' | 'system';

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  time: string;

  @ApiProperty()
  read: boolean;
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
