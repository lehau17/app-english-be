import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsString,
  IsOptional,
  IsNotEmpty,
  ValidateNested,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============= ACTIVITY CONTENT TYPES FOR ASSIGNMENT =============

// Common interfaces
export class VocabItem {
  @ApiProperty({ description: 'Word or phrase' })
  @IsString()
  @IsNotEmpty()
  word!: string;

  @ApiProperty({ description: 'Definition of the word' })
  @IsString()
  @IsNotEmpty()
  definition!: string;

  @ApiProperty({ description: 'Example sentences', type: [String] })
  @IsArray()
  @IsString({ each: true })
  examples!: string[];

  @ApiPropertyOptional({ description: 'Image URL for the word' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Audio URL for pronunciation' })
  @IsOptional()
  @IsString()
  audioUrl?: string;
}

export class FlashCard {
  @ApiProperty({ description: 'Front side of the card' })
  @IsString()
  @IsNotEmpty()
  front!: string;

  @ApiProperty({ description: 'Back side of the card' })
  @IsString()
  @IsNotEmpty()
  back!: string;

  @ApiPropertyOptional({ description: 'Image URL for the card' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class ConversationMessage {
  @ApiProperty({
    description: 'Role of the speaker',
    enum: ['user', 'assistant'],
  })
  @IsString()
  @IsIn(['user', 'assistant'])
  role!: string;

  @ApiProperty({ description: 'Message text' })
  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class MatchingPair {
  @ApiProperty({ description: 'Left side of the matching pair' })
  @IsString()
  @IsNotEmpty()
  left!: string;

  @ApiProperty({ description: 'Right side of the matching pair' })
  @IsString()
  @IsNotEmpty()
  right!: string;
}

// Content types for each activity
export class QuizContent {
  @ApiProperty({ description: 'Quiz question' })
  @IsString()
  @IsNotEmpty()
  question!: string;

  @ApiProperty({ description: 'Answer options', type: [String] })
  @IsArray()
  @IsString({ each: true })
  options!: string[];

  @ApiProperty({ description: 'Index of correct answer' })
  @IsInt()
  @Min(0)
  correctIndex!: number;

  @ApiPropertyOptional({ description: 'Explanation for the answer' })
  @IsOptional()
  @IsString()
  explanation?: string;
}

export class VocabContent {
  @ApiProperty({ description: 'Vocabulary items', type: [VocabItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VocabItem)
  items!: VocabItem[];
}

export class ListeningContent {
  @ApiProperty({ description: 'Audio URL for listening' })
  @IsString()
  @IsNotEmpty()
  audioUrl!: string;

  @ApiProperty({ description: 'Listening prompt or question' })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiProperty({ description: 'Answer options', type: [String] })
  @IsArray()
  @IsString({ each: true })
  options!: string[];

  @ApiProperty({ description: 'Index of correct answer' })
  @IsInt()
  @Min(0)
  correctIndex!: number;
}

export class PronunciationContent {
  @ApiProperty({ description: 'Target phrase to pronounce' })
  @IsString()
  @IsNotEmpty()
  phrase!: string;

  @ApiProperty({ description: 'Pronunciation tips', type: [String] })
  @IsArray()
  @IsString({ each: true })
  tips!: string[];

  @ApiPropertyOptional({ description: 'Sample audio URL' })
  @IsOptional()
  @IsString()
  sampleUrl?: string;
}

export class SpeakingContent {
  @ApiProperty({ description: 'Speaking prompt' })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiProperty({ description: 'Minimum speaking duration in seconds' })
  @IsInt()
  @Min(1)
  minSeconds!: number;

  @ApiProperty({ description: 'Speaking tips', type: [String] })
  @IsArray()
  @IsString({ each: true })
  tips!: string[];
}

export class MiniGameContent {
  @ApiProperty({ description: 'Target word or phrase for the game' })
  @IsString()
  @IsNotEmpty()
  target!: string;

  @ApiProperty({ description: 'Word pool for the game', type: [String] })
  @IsArray()
  @IsString({ each: true })
  pool!: string[];

  @ApiProperty({ description: 'Number of game rounds' })
  @IsInt()
  @Min(1)
  rounds!: number;
}

export class ReadingContent {
  @ApiProperty({ description: 'Reading passage' })
  @IsString()
  @IsNotEmpty()
  passage!: string;

  @ApiProperty({ description: 'Reading comprehension question' })
  @IsString()
  @IsNotEmpty()
  question!: string;

  @ApiProperty({ description: 'Answer options', type: [String] })
  @IsArray()
  @IsString({ each: true })
  options!: string[];

  @ApiProperty({ description: 'Index of correct answer' })
  @IsInt()
  @Min(0)
  correctIndex!: number;
}

export class WritingContent {
  @ApiProperty({ description: 'Writing prompt' })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiProperty({ description: 'Minimum word count' })
  @IsInt()
  @Min(1)
  minWords!: number;

  @ApiProperty({ description: 'Writing rubric criteria', type: [String] })
  @IsArray()
  @IsString({ each: true })
  rubric!: string[];
}

export class GrammarContent {
  @ApiProperty({ description: 'Grammar rule explanation' })
  @IsString()
  @IsNotEmpty()
  rule!: string;

  @ApiProperty({ description: 'Grammar question' })
  @IsString()
  @IsNotEmpty()
  question!: string;

  @ApiProperty({ description: 'Answer options', type: [String] })
  @IsArray()
  @IsString({ each: true })
  options!: string[];

  @ApiProperty({ description: 'Index of correct answer' })
  @IsInt()
  @Min(0)
  correctIndex!: number;
}

export class FlashcardContent {
  @ApiProperty({ description: 'Flashcards', type: [FlashCard] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlashCard)
  cards!: FlashCard[];
}

export class ConversationContent {
  @ApiProperty({ description: 'Conversation scenario' })
  @IsString()
  @IsNotEmpty()
  scenario!: string;

  @ApiProperty({
    description: 'Initial dialog messages',
    type: [ConversationMessage],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessage)
  initialDialog!: ConversationMessage[];

  @ApiProperty({ description: 'Conversation suggestions', type: [String] })
  @IsArray()
  @IsString({ each: true })
  suggestions!: string[];
}

export class FillBlankContent {
  @ApiProperty({ description: 'Passage with blanks (use ___ for blanks)' })
  @IsString()
  @IsNotEmpty()
  passage!: string;

  @ApiProperty({ description: 'Correct answers for blanks', type: [String] })
  @IsArray()
  @IsString({ each: true })
  blanks!: string[];
}

export class DictationContent {
  @ApiProperty({ description: 'Audio URL for dictation' })
  @IsString()
  @IsNotEmpty()
  audioUrl!: string;

  @ApiProperty({ description: 'Correct transcript' })
  @IsString()
  @IsNotEmpty()
  transcript!: string;

  @ApiProperty({ description: 'Minimum word count for submission' })
  @IsInt()
  @Min(0)
  minWords!: number;
}

export class MatchingContent {
  @ApiProperty({ description: 'Matching pairs', type: [MatchingPair] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchingPair)
  pairs!: MatchingPair[];
}

// Union type for all content types
export type ActivityContent =
  | QuizContent
  | VocabContent
  | ListeningContent
  | PronunciationContent
  | SpeakingContent
  | MiniGameContent
  | ReadingContent
  | WritingContent
  | GrammarContent
  | FlashcardContent
  | ConversationContent
  | FillBlankContent
  | DictationContent
  | MatchingContent;
