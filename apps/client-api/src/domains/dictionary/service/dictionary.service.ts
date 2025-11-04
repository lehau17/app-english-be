import { RedisService } from '@app/shared/redis';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WordDefinitionDto, WordResultDto } from '../dto/dictionary.dto';
import { WordsApiResponse, WordsApiService } from './words-api.service';

@Injectable()
export class DictionaryService {
  private readonly logger = new Logger(DictionaryService.name);
  private readonly CACHE_TTL = 7 * 24 * 60 * 60; // 7 days
  private readonly CACHE_PREFIX = 'dict:word:';

  constructor(
    private readonly wordsApiService: WordsApiService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Lookup word with caching
   */
  async lookupWord(word: string): Promise<WordResultDto> {
    const normalizedWord = word.toLowerCase().trim();
    const cacheKey = `${this.CACHE_PREFIX}${normalizedWord}`;

    // Try cache first
    const cached = await this.getCachedWord(cacheKey);
    if (cached) {
      this.logger.log(`📦 Cache hit for word: ${normalizedWord}`);
      return cached;
    }

    // Fetch from WordsAPI
    if (!this.wordsApiService.isConfigured()) {
      return this.getFallbackData(normalizedWord);
    }

    const apiData = await this.wordsApiService.lookupWord(normalizedWord);
    if (!apiData) {
      throw new NotFoundException(`Word "${word}" not found`);
    }

    // Transform API response to DTO
    const result = this.transformApiResponse(apiData);

    // Cache the result
    await this.cacheWord(cacheKey, result);

    return result;
  }

  /**
   * Get word suggestions for autocomplete
   */
  async getSuggestions(query: string, limit = 10): Promise<string[]> {
    const normalizedQuery = query.toLowerCase().trim();

    // Must have at least 2 characters
    if (normalizedQuery.length < 2) {
      return [];
    }

    const cacheKey = `dict:suggestions:${normalizedQuery}:${limit}`;

    // Try cache
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Invalid cache, continue
      }
    }

    // Use fallback dictionary if API not configured or rate limited
    if (!this.wordsApiService.isConfigured()) {
      return this.getFallbackSuggestions(normalizedQuery, limit);
    }

    // Try API
    const suggestions = await this.wordsApiService.searchSimilar(
      normalizedQuery,
      limit,
    );

    // If empty (rate limit or error), use fallback
    if (suggestions.length === 0) {
      return this.getFallbackSuggestions(normalizedQuery, limit);
    }

    // Cache for 1 hour
    await this.redisService.set(cacheKey, JSON.stringify(suggestions), 3600);

    return suggestions;
  }

  /**
   * Get rhyming words
   */
  async getRhymes(word: string): Promise<string[]> {
    const normalizedWord = word.toLowerCase().trim();
    const cacheKey = `dict:rhymes:${normalizedWord}`;

    // Try cache
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from API
    const rhymes = await this.wordsApiService.getRhymes(normalizedWord);

    // Cache for 7 days
    await this.redisService.set(
      cacheKey,
      JSON.stringify(rhymes),
      this.CACHE_TTL,
    );

    return rhymes;
  }

  /**
   * Get recently searched words (from user activity)
   */
  async getRecentSearches(userId: string, limit = 10): Promise<string[]> {
    const key = `dict:recent:${userId}`;
    const recent = await this.redisService.lrange(key, 0, limit - 1);
    return recent || [];
  }

  /**
   * Add word to recent searches
   */
  async addRecentSearch(userId: string, word: string): Promise<void> {
    const key = `dict:recent:${userId}`;
    await this.redisService.lpush(key, word.toLowerCase());
    await this.redisService.ltrim(key, 0, 19); // Keep last 20
    await this.redisService.expire(key, 30 * 24 * 60 * 60); // 30 days
  }

  // ========== Word Relations ==========

  private async getAndCacheRelation(
    word: string,
    relation: 'examples' | 'typeOf' | 'hasTypes' | 'partOf',
  ): Promise<string[]> {
    const normalizedWord = word.toLowerCase().trim();
    const cacheKey = `dict:${relation}:${normalizedWord}`;

    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    let result: string[];
    switch (relation) {
      case 'examples':
        result = await this.wordsApiService.getExamples(normalizedWord);
        break;
      case 'typeOf':
        result = await this.wordsApiService.getTypeOf(normalizedWord);
        break;
      case 'hasTypes':
        result = await this.wordsApiService.getHasTypes(normalizedWord);
        break;
      case 'partOf':
        result = await this.wordsApiService.getPartOf(normalizedWord);
        break;
      default:
        result = [];
    }

    // Cache the result for 7 days
    await this.redisService.set(
      cacheKey,
      JSON.stringify(result),
      this.CACHE_TTL,
    );

    return result;
  }

  async getExamples(word: string): Promise<string[]> {
    return this.getAndCacheRelation(word, 'examples');
  }

  async getTypeOf(word: string): Promise<string[]> {
    return this.getAndCacheRelation(word, 'typeOf');
  }

  async getHasTypes(word: string): Promise<string[]> {
    return this.getAndCacheRelation(word, 'hasTypes');
  }

  async getPartOf(word: string): Promise<string[]> {
    return this.getAndCacheRelation(word, 'partOf');
  }

  async advancedSearch(params: any): Promise<any> {
    // Filter out undefined or null params
    const activeParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null),
    );

    const cacheKey = `dict:search:${JSON.stringify(activeParams)}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const results = await this.wordsApiService.advancedSearch(activeParams);

    // Cache for 1 hour
    await this.redisService.set(cacheKey, JSON.stringify(results), 3600);

    return results;
  }

  // ========== Private Methods ==========

  private async getCachedWord(key: string): Promise<WordResultDto | null> {
    try {
      const cached = await this.redisService.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.error(`Cache read error: ${error.message}`);
    }
    return null;
  }

  private async cacheWord(key: string, data: WordResultDto): Promise<void> {
    try {
      await this.redisService.set(key, JSON.stringify(data), this.CACHE_TTL);
    } catch (error) {
      this.logger.error(`Cache write error: ${error.message}`);
    }
  }

  private transformApiResponse(apiData: WordsApiResponse): WordResultDto {
    const word = apiData.word;
    const pronunciation = apiData.pronunciation?.all;

    // Group definitions by part of speech
    const definitions: WordDefinitionDto[] = [];
    const allSynonyms = new Set<string>();
    const allAntonyms = new Set<string>();

    if (apiData.results) {
      for (const result of apiData.results) {
        definitions.push({
          word,
          partOfSpeech: result.partOfSpeech || 'unknown',
          definition: result.definition,
          example: result.examples?.[0],
          synonyms: result.synonyms,
          antonyms: result.antonyms,
          pronunciation,
        });

        result.synonyms?.forEach((s) => allSynonyms.add(s));
        result.antonyms?.forEach((a) => allAntonyms.add(a));
      }
    }

    return {
      word,
      pronunciation,
      audioUrl: this.wordsApiService.getPronunciationUrl(word),
      definitions:
        definitions.length > 0 ? definitions : this.getDefaultDefinition(word),
      frequency: apiData.frequency,
      synonyms: Array.from(allSynonyms).slice(0, 10),
      antonyms: Array.from(allAntonyms).slice(0, 10),
      syllables: apiData.syllables,
    };
  }

  private getDefaultDefinition(word: string): WordDefinitionDto[] {
    return [
      {
        word,
        partOfSpeech: 'unknown',
        definition: `Definition for "${word}" is not available.`,
      },
    ];
  }

  private getFallbackData(word: string): WordResultDto {
    this.logger.warn(
      `Using fallback data for "${word}" - WordsAPI not configured`,
    );

    return {
      word,
      definitions: [
        {
          word,
          partOfSpeech: 'noun',
          definition: `This is a placeholder definition for "${word}". Configure WORDS_API_KEY to get real data.`,
        },
      ],
    };
  }

  /**
   * Fallback suggestions from common English words list
   */
  private getFallbackSuggestions(query: string, limit: number): string[] {
    // Common English words for autocomplete fallback
    const commonWords = [
      'hello',
      'world',
      'example',
      'test',
      'word',
      'language',
      'english',
      'learning',
      'beautiful',
      'wonderful',
      'amazing',
      'fantastic',
      'excellent',
      'great',
      'good',
      'happy',
      'sad',
      'angry',
      'excited',
      'calm',
      'peaceful',
      'strong',
      'weak',
      'hot',
      'cold',
      'warm',
      'cool',
      'big',
      'small',
      'large',
      'tiny',
      'cat',
      'dog',
      'bird',
      'fish',
      'animal',
      'pet',
      'house',
      'home',
      'book',
      'read',
      'write',
      'learn',
      'study',
      'teach',
      'school',
      'student',
      'work',
      'play',
      'run',
      'walk',
      'jump',
      'swim',
      'fly',
      'drive',
      'eat',
      'drink',
      'sleep',
      'wake',
      'talk',
      'listen',
      'watch',
      'see',
      'think',
      'know',
      'understand',
      'believe',
      'hope',
      'wish',
      'want',
      'need',
      'love',
      'like',
      'enjoy',
      'prefer',
      'choose',
      'decide',
      'try',
      'help',
    ];

    return commonWords.filter((w) => w.startsWith(query)).slice(0, limit);
  }
}
