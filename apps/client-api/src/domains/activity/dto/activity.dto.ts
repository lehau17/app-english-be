import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityType, DifficultyLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested
} from 'class-validator';

import { IsNotEmpty, IsObject, Min } from 'class-validator';

// ============= ACTIVITY CONTENT TYPES =============

// Common interfaces
export class VocabItem {
  @ApiProperty({ description: 'Word or phrase' })
  @IsString() @IsNotEmpty()
  word!: string;

  @ApiProperty({ description: 'Definition of the word' })
  @IsString() @IsNotEmpty()
  definition!: string;

  @ApiProperty({ description: 'Example sentences', type: [String] })
  @IsArray() @IsString({ each: true })
  examples!: string[];

  @ApiPropertyOptional({ description: 'Image URL for the word' })
  @IsOptional() @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Audio URL for pronunciation' })
  @IsOptional() @IsString()
  audioUrl?: string;
}

export class FlashCard {
  @ApiProperty({ description: 'Front side of the card' })
  @IsString() @IsNotEmpty()
  front!: string;

  @ApiProperty({ description: 'Back side of the card' })
  @IsString() @IsNotEmpty()
  back!: string;

  @ApiPropertyOptional({ description: 'Image URL for the card' })
  @IsOptional() @IsString()
  imageUrl?: string;
}

export class ConversationMessage {
  @ApiProperty({ description: 'Role of the speaker', enum: ['user', 'assistant'] })
  @IsString() @IsIn(['user', 'assistant'])
  role!: string;

  @ApiProperty({ description: 'Message text' })
  @IsString() @IsNotEmpty()
  text!: string;
}

export class MatchingPair {
  @ApiProperty({ description: 'Left side of the matching pair' })
  @IsString() @IsNotEmpty()
  left!: string;

  @ApiProperty({ description: 'Right side of the matching pair' })
  @IsString() @IsNotEmpty()
  right!: string;
}

// Content types for each activity
export class QuizContent {
  @ApiProperty({ description: 'Quiz question' })
  @IsString() @IsNotEmpty()
  question!: string;

  @ApiProperty({ description: 'Answer options', type: [String] })
  @IsArray() @IsString({ each: true })
  options!: string[];

  @ApiProperty({ description: 'Index of correct answer' })
  @IsInt() @Min(0)
  correctIndex!: number;

  @ApiPropertyOptional({ description: 'Explanation for the answer' })
  @IsOptional() @IsString()
  explanation?: string;
}

export class VocabContent {
  @ApiProperty({ description: 'Vocabulary items', type: [VocabItem] })
  @IsArray() @ValidateNested({ each: true })
  @Type(() => VocabItem)
  items!: VocabItem[];
}

export class ListeningContent {
  @ApiProperty({ description: 'Audio URL for listening' })
  @IsString() @IsNotEmpty()
  audioUrl!: string;

  @ApiProperty({ description: 'Listening prompt or question' })
  @IsString() @IsNotEmpty()
  prompt!: string;

  @ApiProperty({ description: 'Answer options', type: [String] })
  @IsArray() @IsString({ each: true })
  options!: string[];

  @ApiProperty({ description: 'Index of correct answer' })
  @IsInt() @Min(0)
  correctIndex!: number;
}

export class PronunciationContent {
  @ApiProperty({ description: 'Target phrase to pronounce' })
  @IsString() @IsNotEmpty()
  phrase!: string;

  @ApiProperty({ description: 'Pronunciation tips', type: [String] })
  @IsArray() @IsString({ each: true })
  tips!: string[];

  @ApiPropertyOptional({ description: 'Sample audio URL' })
  @IsOptional() @IsString()
  sampleUrl?: string;
}

export class SpeakingContent {
  @ApiProperty({ description: 'Speaking prompt' })
  @IsString() @IsNotEmpty()
  prompt!: string;

  @ApiProperty({ description: 'Minimum speaking duration in seconds' })
  @IsInt() @Min(1)
  minSeconds!: number;

  @ApiProperty({ description: 'Speaking tips', type: [String] })
  @IsArray() @IsString({ each: true })
  tips!: string[];
}

export class MiniGameContent {
  @ApiProperty({ description: 'Target word or phrase for the game' })
  @IsString() @IsNotEmpty()
  target!: string;

  @ApiProperty({ description: 'Word pool for the game', type: [String] })
  @IsArray() @IsString({ each: true })
  pool!: string[];

  @ApiProperty({ description: 'Number of game rounds' })
  @IsInt() @Min(1)
  rounds!: number;
}

export class ReadingContent {
  @ApiProperty({ description: 'Reading passage' })
  @IsString() @IsNotEmpty()
  passage!: string;

  @ApiProperty({ description: 'Reading comprehension question' })
  @IsString() @IsNotEmpty()
  question!: string;

  @ApiProperty({ description: 'Answer options', type: [String] })
  @IsArray() @IsString({ each: true })
  options!: string[];

  @ApiProperty({ description: 'Index of correct answer' })
  @IsInt() @Min(0)
  correctIndex!: number;
}

export class WritingContent {
  @ApiProperty({ description: 'Writing prompt' })
  @IsString() @IsNotEmpty()
  prompt!: string;

  @ApiProperty({ description: 'Minimum word count' })
  @IsInt() @Min(1)
  minWords!: number;

  @ApiProperty({ description: 'Writing rubric criteria', type: [String] })
  @IsArray() @IsString({ each: true })
  rubric!: string[];
}

export class GrammarContent {
  @ApiProperty({ description: 'Grammar rule explanation' })
  @IsString() @IsNotEmpty()
  rule!: string;

  @ApiProperty({ description: 'Grammar question' })
  @IsString() @IsNotEmpty()
  question!: string;

  @ApiProperty({ description: 'Answer options', type: [String] })
  @IsArray() @IsString({ each: true })
  options!: string[];

  @ApiProperty({ description: 'Index of correct answer' })
  @IsInt() @Min(0)
  correctIndex!: number;
}

export class FlashcardContent {
  @ApiProperty({ description: 'Flashcards', type: [FlashCard] })
  @IsArray() @ValidateNested({ each: true })
  @Type(() => FlashCard)
  cards!: FlashCard[];
}

export class ConversationContent {
  @ApiProperty({ description: 'Conversation scenario' })
  @IsString() @IsNotEmpty()
  scenario!: string;

  @ApiProperty({ description: 'Initial dialog messages', type: [ConversationMessage] })
  @IsArray() @ValidateNested({ each: true })
  @Type(() => ConversationMessage)
  initialDialog!: ConversationMessage[];

  @ApiProperty({ description: 'Conversation suggestions', type: [String] })
  @IsArray() @IsString({ each: true })
  suggestions!: string[];
}

export class FillBlankContent {
  @ApiProperty({ description: 'Passage with blanks (use ___ for blanks)' })
  @IsString() @IsNotEmpty()
  passage!: string;

  @ApiProperty({ description: 'Correct answers for blanks', type: [String] })
  @IsArray() @IsString({ each: true })
  blanks!: string[];
}

export class DictationContent {
  @ApiProperty({ description: 'Audio URL for dictation' })
  @IsString() @IsNotEmpty()
  audioUrl!: string;

  @ApiProperty({ description: 'Correct transcript' })
  @IsString() @IsNotEmpty()
  transcript!: string;

  @ApiProperty({ description: 'Minimum word count for submission' })
  @IsInt() @Min(0)
  minWords!: number;
}

export class MatchingContent {
  @ApiProperty({ description: 'Matching pairs', type: [MatchingPair] })
  @IsArray() @ValidateNested({ each: true })
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

// ============= MAIN DTO CLASSES =============


export class CreateActivityDto {
  // NESTED theo lesson => KHÔNG cần lessonId
  @ApiProperty({ enum: ActivityType, description: 'Type of the activity.' })
  @IsEnum(ActivityType)
  type!: ActivityType;

  @ApiProperty({ description: 'Order of the activity within the lesson.' })
  @IsInt() @Min(1)
  orderNo!: number;

  @ApiProperty({ description: 'Title of the activity.' })
  @IsString() @IsNotEmpty()
  title!: string;

  @ApiProperty({ type: 'object', description: 'Typed content based on activity type' })
  @IsObject()
  content!: ActivityContent;

  @ApiPropertyOptional({ description: 'Time limit (minutes).' })
  @IsOptional() @IsInt() @Min(1)
  timeLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum number of attempts.' })
  @IsOptional() @IsInt() @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional({ description: 'Passing score (0–100).' })
  @IsOptional() @IsInt() @Min(0)
  passingScore?: number;

  @ApiPropertyOptional({
    enum: DifficultyLevel,
    description: 'Difficulty level of the activity.',
    default: DifficultyLevel.beginner,
  })
  @IsOptional()
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ description: 'XP points', default: 10 })
  @IsOptional() @IsInt() @Min(0)
  points?: number;

  @ApiPropertyOptional({ description: 'Instructions for the activity.' })
  @IsOptional() @IsString()
  instructions?: string;

  @ApiPropertyOptional({ type: [String], description: 'Hints (plain text list).' })
  @IsOptional() @IsArray() @IsString({ each: true })
  hints?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Attached media URLs.' })
  @IsOptional() @IsArray() @IsString({ each: true })
  mediaUrls?: string[];
}
export class UpdateActivityDto {
  @ApiPropertyOptional({ enum: ActivityType, example: ActivityType.listening })
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  orderNo?: number;

  @ApiPropertyOptional({ description: 'Activity title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ type: 'object', description: 'Typed content based on activity type' })
  @IsOptional()
  @IsObject()
  content?: Partial<ActivityContent>;

  @ApiPropertyOptional({ description: 'Time limit (minutes).' })
  @IsOptional() @IsInt() @Min(1)
  timeLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum number of attempts.' })
  @IsOptional() @IsInt() @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional({ description: 'Passing score (0–100).' })
  @IsOptional() @IsInt() @Min(0)
  passingScore?: number;

  @ApiPropertyOptional({
    enum: DifficultyLevel,
    description: 'Difficulty level of the activity.',
  })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ description: 'XP points' })
  @IsOptional() @IsInt() @Min(0)
  points?: number;

  @ApiPropertyOptional({ description: 'Instructions for the activity.' })
  @IsOptional() @IsString()
  instructions?: string;

  @ApiPropertyOptional({ type: [String], description: 'Hints (plain text list).' })
  @IsOptional() @IsArray() @IsString({ each: true })
  hints?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Attached media URLs.' })
  @IsOptional() @IsArray() @IsString({ each: true })
  mediaUrls?: string[];
}

export class FilterActivityRequestDto extends RequestPagingDto {
  @ApiPropertyOptional({ description: 'Search by content', example: 'Grammar' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by lessonId',
    example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
  })
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @ApiPropertyOptional({ enum: ActivityType, description: 'Filter by type' })
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;
}

// ============= HELPER FUNCTIONS =============

/**
 * Get default content structure for each activity type
 */
export function getDefaultContentByType(type: ActivityType): ActivityContent {
  switch (type) {
    case ActivityType.quiz:
      return { question: "", options: ["", ""], correctIndex: 0, explanation: "" };

    case ActivityType.vocab:
      return {
        items: [
          { word: "", definition: "", examples: [""], imageUrl: "", audioUrl: "" }
        ]
      };

    case ActivityType.listening:
      return { audioUrl: "", prompt: "", options: ["", ""], correctIndex: 0 };

    case ActivityType.pronunciation:
      return { phrase: "", tips: [""], sampleUrl: "" };

    case ActivityType.speaking:
      return { prompt: "", minSeconds: 15, tips: [""] };

    case ActivityType.mini_game:
      return { target: "", pool: [""], rounds: 3 };

    case ActivityType.reading:
      return { passage: "", question: "", options: ["", ""], correctIndex: 0 };

    case ActivityType.writing:
      return { prompt: "", minWords: 40, rubric: [""] };

    case ActivityType.grammar:
      return { rule: "", question: "", options: ["", ""], correctIndex: 0 };

    case ActivityType.flashcard:
      return { cards: [{ front: "", back: "", imageUrl: "" }] };

    case ActivityType.conversation:
      return { scenario: "", initialDialog: [{ role: "assistant", text: "" }], suggestions: [""] };

    case ActivityType.fill_blank:
      return { passage: "", blanks: [""] };

    case ActivityType.dictation:
      return { audioUrl: "", transcript: "", minWords: 0 };

    case ActivityType.matching:
      return { pairs: [{ left: "", right: "" }] };

    default:
      return {} as ActivityContent;
  }
}

/**
 * Validate if content matches the expected type structure
 */
export function validateContentForType(type: ActivityType, content: any): boolean {
  if (!content || typeof content !== 'object') return false;

  switch (type) {
    case ActivityType.quiz:
      return 'question' in content && 'options' in content && 'correctIndex' in content;

    case ActivityType.vocab:
      return 'items' in content && Array.isArray(content.items);

    case ActivityType.listening:
      return 'audioUrl' in content && 'prompt' in content && 'options' in content && 'correctIndex' in content;

    case ActivityType.pronunciation:
      return 'phrase' in content && 'tips' in content;

    case ActivityType.speaking:
      return 'prompt' in content && 'minSeconds' in content;

    case ActivityType.mini_game:
      return 'target' in content && 'pool' in content && 'rounds' in content;

    case ActivityType.reading:
      return 'passage' in content && 'question' in content && 'options' in content && 'correctIndex' in content;

    case ActivityType.writing:
      return 'prompt' in content && 'minWords' in content;

    case ActivityType.grammar:
      return 'rule' in content && 'question' in content && 'options' in content && 'correctIndex' in content;

    case ActivityType.flashcard:
      return 'cards' in content && Array.isArray(content.cards);

    case ActivityType.conversation:
      return 'scenario' in content && 'initialDialog' in content && 'suggestions' in content;

    case ActivityType.fill_blank:
      return 'passage' in content && 'blanks' in content;

    case ActivityType.dictation:
      return 'audioUrl' in content && 'transcript' in content;

    case ActivityType.matching:
      return 'pairs' in content && Array.isArray(content.pairs);

    default:
      return false;
  }
}
