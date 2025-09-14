import { ApiProperty } from '@nestjs/swagger';

export enum ListeningActivityType {
  QUICK_QUIZ = 'quick_quiz',
  DICTATION = 'dictation',
  COMPREHENSION = 'comprehension',
  PRONUNCIATION = 'pronunciation',
  VOCABULARY = 'vocabulary',
  SPEAKING_AI = 'speaking_ai',
  WRITING = 'writing',
  SUMMARY = 'summary',
}

export class PodcastActivityEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  podcastId: string;

  @ApiProperty({ enum: ListeningActivityType })
  type: ListeningActivityType;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  orderNo: number;

  @ApiProperty({ required: false })
  timeLimit?: number; // seconds

  @ApiProperty({ required: false })
  maxAttempts?: number;

  @ApiProperty({ required: false })
  passingScore?: number; // percentage

  @ApiProperty()
  points: number;

  @ApiProperty({ type: 'object' })
  content: any; // JSON content

  @ApiProperty({ required: false })
  instructions?: string;

  @ApiProperty({ type: [String] })
  hints: string[];

  @ApiProperty()
  isLocked: boolean;

  @ApiProperty({ required: false })
  unlockAfter?: string; // Activity ID

  @ApiProperty()
  isPremium: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Virtual fields for user interaction
  @ApiProperty({ required: false })
  userProgress?: {
    bestScore?: number;
    isPassed: boolean;
    attemptCount: number;
    lastAttempt?: Date;
  };
}

export class PodcastActivityAttemptEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  activityId: string;

  @ApiProperty()
  attemptNo: number;

  @ApiProperty({ required: false })
  score?: number;

  @ApiProperty({ required: false })
  maxScore?: number;

  @ApiProperty({ required: false })
  isCorrect?: boolean;

  @ApiProperty()
  isPassed: boolean;

  @ApiProperty({ required: false })
  timeSpent?: number; // seconds

  @ApiProperty({ type: 'object' })
  answers: any; // JSON

  @ApiProperty({ type: 'object', required: false })
  feedback?: any; // JSON

  @ApiProperty({ type: [String] })
  strengths: string[];

  @ApiProperty({ type: [String] })
  weaknesses: string[];

  @ApiProperty({ type: [String] })
  suggestions: string[];

  @ApiProperty()
  createdAt: Date;
}
