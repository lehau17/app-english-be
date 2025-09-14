import { ApiProperty } from '@nestjs/swagger';

export enum PodcastStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  SCHEDULED = 'scheduled',
}

export enum PodcastCategory {
  STUDY_ABROAD = 'study_abroad',
  BUSINESS = 'business',
  TECHNOLOGY = 'technology',
  LIFESTYLE = 'lifestyle',
  ENTERTAINMENT = 'entertainment',
  EDUCATION = 'education',
  NEWS = 'news',
  CULTURE = 'culture',
  SCIENCE = 'science',
  TRAVEL = 'travel',
}

export enum PodcastSource {
  WELE_PARTNERS = 'wele_partners',
  TED_TALKS = 'ted_talks',
  BBC = 'bbc',
  CNN = 'cnn',
  VOICE_OF_AMERICA = 'voice_of_america',
  BRITISH_COUNCIL = 'british_council',
  INTERNAL = 'internal',
}

export enum PodcastDifficulty {
  BEGINNER = 'beginner',
  ELEMENTARY = 'elementary',
  INTERMEDIATE = 'intermediate',
  UPPER_INTERMEDIATE = 'upper_intermediate',
  ADVANCED = 'advanced',
}

export class PodcastEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  subtitle?: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ required: false })
  storyTitle?: string;

  @ApiProperty({ required: false })
  storyContent?: string;

  @ApiProperty()
  audioUrl: string;

  @ApiProperty({ required: false })
  thumbnailUrl?: string;

  @ApiProperty({ required: false })
  transcriptUrl?: string;

  @ApiProperty({ enum: PodcastCategory })
  category: PodcastCategory;

  @ApiProperty({ enum: PodcastSource })
  source: PodcastSource;

  @ApiProperty({ enum: PodcastDifficulty })
  difficulty: PodcastDifficulty;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty()
  duration: number; // seconds

  @ApiProperty({ required: false })
  durationFormatted?: string; // "12:34"

  @ApiProperty()
  viewCount: number;

  @ApiProperty()
  likeCount: number;

  @ApiProperty()
  saveCount: number;

  @ApiProperty({ enum: PodcastStatus })
  status: PodcastStatus;

  @ApiProperty({ required: false })
  publishedAt?: Date;

  @ApiProperty({ required: false })
  scheduledAt?: Date;

  @ApiProperty({ required: false })
  slug?: string;

  @ApiProperty({ type: [String] })
  keywords: string[];

  @ApiProperty()
  hasTranscript: boolean;

  @ApiProperty()
  hasActivities: boolean;

  @ApiProperty()
  isRecommended: boolean;

  @ApiProperty()
  isPremium: boolean;

  @ApiProperty({ required: false })
  authorId?: string;

  @ApiProperty({ required: false })
  authorName?: string;

  @ApiProperty({ required: false })
  averageRating?: number;

  @ApiProperty()
  totalRatings: number;

  @ApiProperty({ required: false })
  difficultyRating?: number;

  @ApiProperty({ required: false })
  qualityRating?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Virtual fields for user interaction
  @ApiProperty({ required: false })
  userProgress?: {
    currentPosition: number;
    completionRate: number;
    isLiked: boolean;
    isSaved: boolean;
    isCompleted: boolean;
  };

  @ApiProperty({ required: false })
  activitiesCount?: number;
}
