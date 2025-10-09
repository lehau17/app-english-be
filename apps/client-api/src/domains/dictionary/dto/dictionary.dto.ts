import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LookupWordDto {
  @ApiProperty({
    description: 'Word to lookup',
    example: 'example',
  })
  @IsString()
  @IsNotEmpty()
  word: string;
}

export class WordDefinitionDto {
  @ApiProperty({ example: 'example' })
  word: string;

  @ApiProperty({ example: 'noun' })
  partOfSpeech: string;

  @ApiProperty({ example: 'a representative form or pattern' })
  definition: string;

  @ApiPropertyOptional({ example: 'I followed his example' })
  example?: string;

  @ApiPropertyOptional({ example: ['instance', 'case', 'illustration'] })
  synonyms?: string[];

  @ApiPropertyOptional({ example: ['counterexample'] })
  antonyms?: string[];

  @ApiPropertyOptional({ example: '/ɪɡˈzæmpəl/' })
  pronunciation?: string;
}

export class WordResultDto {
  @ApiProperty({ example: 'example' })
  word: string;

  @ApiPropertyOptional({ example: '/ɪɡˈzæmpəl/' })
  pronunciation?: string;

  @ApiPropertyOptional({ example: 'https://audio-url.com/example.mp3' })
  audioUrl?: string;

  @ApiProperty({ type: [WordDefinitionDto] })
  definitions: WordDefinitionDto[];

  @ApiPropertyOptional({ example: 2.5 })
  frequency?: number;

  @ApiPropertyOptional({ example: ['sample', 'model', 'pattern'] })
  synonyms?: string[];

  @ApiPropertyOptional({ example: ['counterexample'] })
  antonyms?: string[];

  @ApiPropertyOptional()
  syllables?: {
    count: number;
    list: string[];
  };
}

export class SearchSuggestionsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;
}

export class WordSuggestionDto {
  @ApiProperty({ example: 'example' })
  word: string;

  @ApiPropertyOptional({ example: 2.5 })
  score?: number;
}
