import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class AgentChatDto {
  @ApiProperty({ description: 'User message to AI' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'Conversation context', required: false })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiProperty({
    description: 'Language code',
    required: false,
    enum: ['en', 'vi', 'es', 'fr'],
  })
  @IsOptional()
  @IsIn(['en', 'vi', 'es', 'fr'])
  language?: string;
}

export class AgentChatResponseDto {
  @ApiProperty({ description: 'AI response message' })
  response: string;

  @ApiProperty({ description: 'Confidence score (0-1)' })
  confidence: number;

  @ApiProperty({ description: 'Source citations', required: false })
  sources?: string[];

  @ApiProperty({ description: 'Follow-up suggestions', required: false })
  suggestions?: string[];

  @ApiProperty({ description: 'Tools used in processing', required: false })
  toolsUsed?: string[];

  @ApiProperty({ description: 'Reasoning steps', required: false })
  reasoning?: string;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    required: false,
  })
  processingTime?: number;

  @ApiProperty({ description: 'Execution steps', required: false })
  executionSteps?: any[];
}

export class AgentRecommendationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  confidence: number;
}
