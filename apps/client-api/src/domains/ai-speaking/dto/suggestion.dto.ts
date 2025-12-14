import { IsUUID } from 'class-validator';

export class GetSuggestionsDto {
  @IsUUID()
  sessionId: string;
}

export class SuggestionResponseDto {
  suggestions: string[];
}
