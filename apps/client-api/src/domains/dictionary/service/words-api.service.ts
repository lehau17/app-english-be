import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface WordsApiResponse {
  word: string;
  pronunciation?: {
    all?: string;
  };
  results?: Array<{
    definition: string;
    partOfSpeech: string;
    synonyms?: string[];
    antonyms?: string[];
    examples?: string[];
  }>;
  syllables?: {
    count: number;
    list: string[];
  };
  frequency?: number;
}

@Injectable()
export class WordsApiService {
  private readonly logger = new Logger(WordsApiService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://wordsapiv1.p.rapidapi.com/words';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('WORDS_API_KEY') || '';

    if (!this.apiKey) {
      this.logger.warn(
        '⚠️  WORDS_API_KEY not configured. Dictionary feature will use fallback data.',
      );
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': 'wordsapiv1.p.rapidapi.com',
      },
      timeout: 5000,
    });
  }

  /**
   * Perform an advanced search on WordsAPI
   */
  async advancedSearch(params: { [key: string]: any }): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/', { params });
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `WordsAPI advanced search error: ${error.message}`,
        error.stack,
      );
      return { results: { data: [] } }; // Return an empty structure on error
    }
  }

  /**
   * Lookup word details from WordsAPI
   */
  async lookupWord(word: string): Promise<WordsApiResponse | null> {
    try {
      const response = await this.axiosInstance.get<WordsApiResponse>(
        `/${encodeURIComponent(word.toLowerCase())}`,
      );

      this.logger.log(`✅ Fetched word data for: ${word}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logger.warn(`Word not found: ${word}`);
        return null;
      }

      this.logger.error(
        `WordsAPI error for "${word}": ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get word pronunciation audio URL
   */
  getPronunciationUrl(word: string): string {
    // Using free pronunciation service
    return `https://ssl.gstatic.com/dictionary/static/sounds/20200429/${word.toLowerCase()}--_us_1.mp3`;
  }

  /**
   * Search for similar words
   */
  async searchSimilar(query: string, limit = 10): Promise<string[]> {
    try {
      const response = await this.axiosInstance.get(
        `/?letterPattern=^${encodeURIComponent(query)}.*&limit=${limit}`,
      );

      // WordsAPI returns { results: { data: string[] } }
      const data = response.data;

      if (
        data.results &&
        data.results.data &&
        Array.isArray(data.results.data)
      ) {
        return data.results.data.slice(0, limit);
      }

      // Fallback: if results is array directly
      if (Array.isArray(data.results)) {
        return data.results.map((r: any) => r.word || r).slice(0, limit);
      }

      this.logger.warn(
        `Unexpected WordsAPI response format for query: ${query}`,
      );
      return [];
    } catch (error: any) {
      if (error.response?.status === 429) {
        this.logger.warn(`Rate limit exceeded for suggestions`);
      } else {
        this.logger.error(`Search error: ${error.message}`);
      }
      return [];
    }
  }

  /**
   * Get rhymes for a word
   */
  async getRhymes(word: string): Promise<string[]> {
    try {
      const response = await this.axiosInstance.get<WordsApiResponse>(
        `/${encodeURIComponent(word.toLowerCase())}/rhymes`,
      );

      return (response.data as any).rhymes?.all || [];
    } catch (error: any) {
      this.logger.error(`Rhymes error: ${error.message}`);
      return [];
    }
  }

  /**
   * Generic method to fetch word relations like 'examples', 'typeOf', etc.
   */
  private async getWordRelation(
    word: string,
    relation: 'examples' | 'typeOf' | 'hasTypes' | 'partOf',
  ): Promise<any> {
    try {
      const response = await this.axiosInstance.get(
        `/${encodeURIComponent(word.toLowerCase())}/${relation}`,
      );
      // The response contains the word and the relation array, e.g., { word: 'car', examples: [...] }
      return response.data?.[relation] || [];
    } catch (error: any) {
      if (error.response?.status !== 404) {
        this.logger.error(
          `WordsAPI error for "${word}/${relation}": ${error.message}`,
        );
      }
      return [];
    }
  }

  async getExamples(word: string): Promise<string[]> {
    return this.getWordRelation(word, 'examples');
  }

  async getTypeOf(word: string): Promise<string[]> {
    return this.getWordRelation(word, 'typeOf');
  }

  async getHasTypes(word: string): Promise<string[]> {
    return this.getWordRelation(word, 'hasTypes');
  }

  async getPartOf(word: string): Promise<string[]> {
    return this.getWordRelation(word, 'partOf');
  }

  /**
   * Check if API is configured and available
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
