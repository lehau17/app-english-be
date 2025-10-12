import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuizQuestionDto {
  @ApiProperty({
    description: 'The word to be defined.',
    example: 'ephemeral',
  })
  questionWord: string;

  @ApiProperty({
    description: 'A list of 4 possible definitions.',
    example: [
      'lasting for a very short time',
      'a feeling of great happiness',
      'the quality of being everywhere at the same time',
      'a long, angry speech of criticism or accusation',
    ],
  })
  options: string[];

  @ApiProperty({
    description: 'The correct definition.',
    example: 'lasting for a very short time',
  })
  correctAnswer: string;
}

export class QuizDto {
  @ApiProperty({
    description: 'A list of quiz questions.',
    type: [QuizQuestionDto],
  })
  questions: QuizQuestionDto[];
}

export class FlashcardDto {
  @ApiProperty({ example: 'serendipity' })
  word: string;

  @ApiPropertyOptional({ example: '/ˌsɛrənˈdɪpɪti/' })
  pronunciation?: string;

  @ApiPropertyOptional({
    example: 'the occurrence and development of events by chance in a happy or beneficial way',
  })
  definition?: string;

  @ApiPropertyOptional({
    example: 'it was a stroke of serendipity that I found my lost keys',
  })
  example?: string;

  @ApiPropertyOptional({ example: 'https://audio-url.com/serendipity.mp3' })
  audioUrl?: string;
}