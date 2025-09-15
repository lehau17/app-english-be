import { ApiProperty } from '@nestjs/swagger';

export enum ListeningActivityType {
  FILL_BLANK = 'fill_blank',
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

  @ApiProperty()
  points: number;

  @ApiProperty({ type: 'object', description: 'Fill blank content structure' })
  content: {
    type: 'fill_blank';
    totalQuestions: number;
    questions: Array<{
      id: string;
      sentence: string;
      correctAnswers: string[];
    }>;
  };

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
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

  @ApiProperty({ description: 'Number of correct answers' })
  correctCount: number;

  @ApiProperty({ description: 'Total number of questions' })
  totalQuestions: number;

  @ApiProperty({ description: 'Score as percentage (0-100)' })
  scorePercent: number;

  @ApiProperty({ required: false })
  timeSpent?: number; // seconds

  @ApiProperty({ type: 'object', description: 'User answers for each question' })
  answers: any;

  @ApiProperty()
  createdAt: Date;
}
