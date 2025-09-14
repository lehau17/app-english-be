import { ApiProperty } from '@nestjs/swagger';

export class UserPodcastProgressEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  podcastId: string;

  @ApiProperty()
  currentPosition: number; // seconds

  @ApiProperty()
  totalListened: number; // total seconds listened

  @ApiProperty()
  completionRate: number; // 0-100%

  @ApiProperty()
  activitiesCompleted: number;

  @ApiProperty()
  totalActivities: number;

  @ApiProperty({ required: false })
  bestScore?: number;

  @ApiProperty({ required: false })
  averageScore?: number;

  @ApiProperty()
  isLiked: boolean;

  @ApiProperty()
  isSaved: boolean;

  @ApiProperty()
  isCompleted: boolean;

  @ApiProperty()
  firstListenAt: Date;

  @ApiProperty()
  lastListenAt: Date;

  @ApiProperty({ required: false })
  completedAt?: Date;

  @ApiProperty()
  sessionCount: number;

  @ApiProperty()
  totalStudyTime: number; // minutes
}

export class PodcastRatingEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  podcastId: string;

  @ApiProperty()
  overallRating: number; // 1-5

  @ApiProperty()
  difficultyRating: number; // 1-5

  @ApiProperty()
  qualityRating: number; // 1-5

  @ApiProperty({ required: false })
  contentRating?: number; // 1-5

  @ApiProperty({ required: false })
  audioRating?: number; // 1-5

  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty({ required: false })
  comment?: string;

  @ApiProperty({ type: [String] })
  pros: string[];

  @ApiProperty({ type: [String] })
  cons: string[];

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty()
  isModerated: boolean;

  @ApiProperty()
  helpfulCount: number;

  @ApiProperty()
  unhelpfulCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Virtual fields
  @ApiProperty({ required: false })
  user?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export class PlaylistEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  isSystem: boolean;

  @ApiProperty({ required: false })
  thumbnailUrl?: string;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ required: false })
  category?: string;

  @ApiProperty()
  podcastCount: number;

  @ApiProperty()
  totalDuration: number; // seconds

  @ApiProperty()
  playCount: number;

  @ApiProperty()
  likeCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Virtual fields
  @ApiProperty({ required: false })
  podcasts?: {
    podcast: any;
    orderNo: number;
    addedAt: Date;
  }[];
}
