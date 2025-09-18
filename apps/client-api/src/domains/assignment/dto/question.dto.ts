// src/assignments/dto/question.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum QuestionTypeDto {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  FILL_BLANK = 'fill_blank',
  MATCHING = 'matching',
  ORDERING = 'ordering',
  ESSAY = 'essay',
  AUDIO_RESPONSE = 'audio_response',
}

export class BaseQuestionDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty({ enum: QuestionTypeDto }) @IsEnum(QuestionTypeDto) type!: QuestionTypeDto;
  @ApiProperty() @IsInt() @Min(1) orderNo!: number;
  @ApiProperty() @IsInt() @Min(0) points!: number;
  @ApiProperty() @IsString() prompt!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() mediaUrl?: string;
}

export class McqQuestionDto extends BaseQuestionDto {
  @ApiProperty({ type: [String] }) @IsArray() options!: string[];
  @ApiProperty() @IsInt() @Min(0) correctIndex!: number;
}
export class TrueFalseQuestionDto extends BaseQuestionDto {
  @ApiProperty() @IsBoolean() correct!: boolean;
}
export class FillBlankQuestionDto extends BaseQuestionDto {
  @ApiProperty({ type: [String] }) @IsArray() correctAnswers!: string[];
}
export class MatchingQuestionDto extends BaseQuestionDto {
  @ApiProperty({ type: [Object] })
  @IsArray() left!: { id: string; text: string }[];
  @ApiProperty({ type: [Object] })
  @IsArray() right!: { id: string; text: string }[];
  @ApiProperty({ type: [Object] })
  @IsArray() solution!: { leftId: string; rightId: string }[];
}
export class OrderingQuestionDto extends BaseQuestionDto {
  @ApiProperty({ type: [Object] })
  @IsArray() items!: { id: string; text: string }[];
  @ApiProperty({ type: [String] })
  @IsArray() correctOrder!: string[];
}
export class EssayQuestionDto extends BaseQuestionDto {
  @ApiPropertyOptional() @IsString() @IsOptional() rubric?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() maxWords?: number;
}
export class AudioResponseQuestionDto extends BaseQuestionDto {
  @ApiPropertyOptional() @IsString() @IsOptional() sampleAudioUrl?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() rubric?: string;
}

export type QuizQuestionUnion =
  | McqQuestionDto
  | TrueFalseQuestionDto
  | FillBlankQuestionDto
  | MatchingQuestionDto
  | OrderingQuestionDto
  | EssayQuestionDto
  | AudioResponseQuestionDto;
