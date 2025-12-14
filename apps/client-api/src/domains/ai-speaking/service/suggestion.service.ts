import { GeminiService } from '@app/shared';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiSpeakingRepository } from '../repository/ai-speaking.repository';

@Injectable()
export class SuggestionService {
  private readonly logger = new Logger(SuggestionService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly repository: AiSpeakingRepository,
  ) {}

  async getSuggestions(sessionId: string): Promise<string[]> {
    const session = await this.repository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const lastTurn = session.turns[session.turns.length - 1];
    const aiSegment = lastTurn?.segments?.find((seg) => seg.role === 'ai');
    const aiLastMessage =
      aiSegment?.transcript || lastTurn?.aiPrompt || 'Hello! Nice to meet you.';

    const prompt = `You are an English conversation assistant.

Context:
- Topic: ${session.topic || 'General conversation'}
- Difficulty: ${session.currentDifficulty || 'intermediate'}
- AI just said: "${aiLastMessage}"

Task: Generate 3 short, natural English response suggestions (1-2 sentences each) that:
1. Are appropriate for ${session.currentDifficulty || 'intermediate'} level learners
2. Respond naturally to what the AI just said
3. Help continue the conversation meaningfully
4. Use simple, practical language

Return ONLY a JSON array of 3 strings, nothing else:
["suggestion1", "suggestion2", "suggestion3"]

Examples:
["That's interesting. Can you tell me more?", "I agree with you. I also think...", "Could you explain that in simpler terms?"]`;

    try {
      const result = await this.geminiService.generateJSONResponse(prompt);
      this.logger.log(`Gemini suggestions raw response: ${result}`);

      const suggestions = JSON.parse(result);

      if (Array.isArray(suggestions) && suggestions.length === 3) {
        return suggestions;
      }

      this.logger.warn(
        `Invalid suggestions format from Gemini: ${JSON.stringify(suggestions)}`,
      );
      return this.getFallbackSuggestions(
        session.currentDifficulty || 'intermediate',
      );
    } catch (error) {
      this.logger.error('Error generating suggestions with Gemini:', error);
      return this.getFallbackSuggestions(
        session.currentDifficulty || 'intermediate',
      );
    }
  }

  private getFallbackSuggestions(difficulty: string): string[] {
    const fallbacks: Record<string, string[]> = {
      beginner: [
        'Yes, I agree with you.',
        'Can you explain more?',
        'I think that is interesting.',
      ],
      intermediate: [
        "That's a great point. I'd like to add...",
        'Could you elaborate on that?',
        'From my perspective, I believe...',
      ],
      advanced: [
        'I see your point, however I would argue that...',
        'That raises an interesting question about...',
        'Building on what you said, I think...',
      ],
    };

    return fallbacks[difficulty] || fallbacks.beginner;
  }
}
