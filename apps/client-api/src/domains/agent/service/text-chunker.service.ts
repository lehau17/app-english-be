import { Injectable, Logger } from '@nestjs/common';

/**
 * TextChunkerService - Smart text chunking with sentence-aware splitting
 *
 * Features:
 * - Token-based chunking (configurable max tokens)
 * - Sentence-aware splitting (doesn't break mid-sentence)
 * - Overlap between chunks for context continuity
 * - Handles multiple languages (EN, VI)
 */
@Injectable()
export class TextChunkerService {
  private readonly logger = new Logger(TextChunkerService.name);

  /**
   * Approximate tokens per word (GPT-style tokenization)
   * English: ~1.3 tokens/word
   * Vietnamese: ~1.5 tokens/word (more tokens due to Unicode)
   */
  private readonly TOKENS_PER_WORD = 1.4;

  /**
   * Split text into chunks with smart sentence handling
   */
  splitIntoChunks(
    text: string,
    options: {
      maxTokens?: number; // Default: 500
      overlapTokens?: number; // Default: 50
      splitOnSentences?: boolean; // Default: true
    } = {},
  ): string[] {
    const maxTokens = options.maxTokens || 500;
    const overlapTokens = options.overlapTokens || 50;
    const splitOnSentences = options.splitOnSentences ?? true;

    // If text is small enough, return as single chunk
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) {
      this.logger.log(
        `📄 Text is small enough (${estimatedTokens} tokens), no chunking needed`,
      );
      return [text];
    }

    this.logger.log(
      `📄 Splitting text (${estimatedTokens} tokens) into chunks (max: ${maxTokens} tokens, overlap: ${overlapTokens} tokens)`,
    );

    if (splitOnSentences) {
      return this.chunkBySentences(text, maxTokens, overlapTokens);
    } else {
      return this.chunkByWords(text, maxTokens, overlapTokens);
    }
  }

  /**
   * Chunk by sentences (smart splitting)
   */
  private chunkBySentences(
    text: string,
    maxTokens: number,
    overlapTokens: number,
  ): string[] {
    // Split into sentences
    const sentences = this.splitIntoSentences(text);

    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);

      // If single sentence is larger than maxTokens, split it by words
      if (sentenceTokens > maxTokens) {
        // Save current chunk if any
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join(' '));
          currentChunk = [];
          currentTokens = 0;
        }

        // Split large sentence by words
        const subChunks = this.chunkByWords(sentence, maxTokens, overlapTokens);
        chunks.push(...subChunks);
        continue;
      }

      // If adding this sentence exceeds maxTokens, save current chunk
      if (
        currentTokens + sentenceTokens > maxTokens &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.join(' '));

        // Start new chunk with overlap
        const overlapSentences = this.getOverlapSentences(
          currentChunk,
          overlapTokens,
        );
        currentChunk = overlapSentences;
        currentTokens = this.estimateTokens(currentChunk.join(' '));
      }

      // Add sentence to current chunk
      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    this.logger.log(
      `Created ${chunks.length} chunks (sentence-aware splitting)`,
    );
    return chunks;
  }

  /**
   * Chunk by words (fallback for very long sentences)
   */
  private chunkByWords(
    text: string,
    maxTokens: number,
    overlapTokens: number,
  ): string[] {
    const words = text.split(/\s+/);
    const maxWords = Math.floor(maxTokens / this.TOKENS_PER_WORD);
    const overlapWords = Math.floor(overlapTokens / this.TOKENS_PER_WORD);

    const chunks: string[] = [];
    let i = 0;

    while (i < words.length) {
      const chunkWords = words.slice(i, i + maxWords);
      chunks.push(chunkWords.join(' '));
      i += maxWords - overlapWords; // Move forward with overlap
    }

    this.logger.log(
      `Created ${chunks.length} chunks (word-based splitting)`,
    );
    return chunks;
  }

  /**
   * Split text into sentences (supports English and Vietnamese)
   */
  private splitIntoSentences(text: string): string[] {
    // Split on common sentence endings: . ! ? and Vietnamese specific endings
    // Keep the punctuation with the sentence
    const sentences = text
      .split(/(?<=[.!?।])\s+/)
      .filter((s) => s.trim().length > 0);

    return sentences;
  }

  /**
   * Get last N sentences that fit within overlap tokens
   */
  private getOverlapSentences(
    sentences: string[],
    overlapTokens: number,
  ): string[] {
    const result: string[] = [];
    let tokens = 0;

    // Start from the end and work backwards
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentenceTokens = this.estimateTokens(sentences[i]);
      if (tokens + sentenceTokens > overlapTokens) {
        break;
      }
      result.unshift(sentences[i]);
      tokens += sentenceTokens;
    }

    return result;
  }

  /**
   * Estimate token count for text (approximate)
   */
  estimateTokens(text: string): number {
    const words = text.split(/\s+/).length;
    return Math.ceil(words * this.TOKENS_PER_WORD);
  }

  /**
   * Get recommended chunk options based on document length
   */
  getRecommendedOptions(text: string): {
    maxTokens: number;
    overlapTokens: number;
    shouldChunk: boolean;
  } {
    const tokens = this.estimateTokens(text);

    if (tokens <= 500) {
      return { maxTokens: 500, overlapTokens: 0, shouldChunk: false };
    }

    if (tokens <= 2000) {
      return { maxTokens: 500, overlapTokens: 50, shouldChunk: true };
    }

    if (tokens <= 10000) {
      return { maxTokens: 800, overlapTokens: 100, shouldChunk: true };
    }

    // Very large documents
    return { maxTokens: 1000, overlapTokens: 150, shouldChunk: true };
  }
}
