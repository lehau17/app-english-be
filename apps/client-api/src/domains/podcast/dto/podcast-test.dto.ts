import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsObject, IsOptional, Min } from 'class-validator';

export class SubmitPodcastTestDto {
  @ApiProperty({
    description: 'User answers for fill-in-the-blank questions',
    example: { "q1": "Five", "q2": "English", "q3": "BBC" },
  })
  @IsNotEmpty()
  @IsObject()
  answers: Record<string, string>;

  @ApiProperty({
    description: 'Time spent on the test in seconds',
    example: 180,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  timeSpent?: number;
}

export class PodcastTestResponseDto {
  @ApiProperty({ description: 'Podcast ID' })
  podcastId: string;

  @ApiProperty({ description: 'Podcast title' })
  title: string;

  @ApiProperty({ description: 'Audio URL' })
  audioUrl: string;

  @ApiProperty({ description: 'Transcript with blanks' })
  transcript?: string;

  @ApiProperty({
    description: 'Fill-in-the-blank content',
    example: {
      sentences: [
        {
          id: "q1",
          sentence: "Hello, this is _____ Minute _____ from _____.",
          correctAnswers: ["Five", "English", "BBC"]
        }
      ],
      timeLimit: 300,
      totalQuestions: 5
    }
  })
  fillBlankContent?: any;

  @ApiProperty({ description: 'User best score if any' })
  bestScore?: number;

  @ApiProperty({ description: 'Number of attempts made' })
  attemptCount?: number;
}

export class TestResultDto {
  @ApiProperty({ description: 'Attempt ID' })
  id: string;

  @ApiProperty({ description: 'Score percentage (0-100)' })
  scorePercent: number;

  @ApiProperty({ description: 'Correct answers count' })
  correctCount: number;

  @ApiProperty({ description: 'Total questions' })
  totalQuestions: number;

  @ApiProperty({ description: 'Time spent in seconds' })
  timeSpent?: number;

  @ApiProperty({ description: 'Attempt number' })
  attemptNo: number;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;
}
