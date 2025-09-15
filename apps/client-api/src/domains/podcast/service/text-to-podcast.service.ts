import { PrismaRepository } from '@app/database';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PodcastActivityType } from '../dto/podcast-activity.dto';
import { CreatePodcastFromTextDto, GenerateActivitiesDto } from '../dto/text-to-podcast.dto';
import { PodcastActivityService } from './podcast-activity.service';
import { PodcastService } from './podcast.service';

@Injectable()
export class TextToPodcastService {
  private readonly logger = new Logger(TextToPodcastService.name);
  private readonly uploadsPath = 'uploads/podcasts';

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly configService: ConfigService,
    private readonly podcastService: PodcastService,
    private readonly activityService: PodcastActivityService,
  ) {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsPath)) {
      fs.mkdirSync(this.uploadsPath, { recursive: true });
    }
  }

  async createPodcastFromText(dto: CreatePodcastFromTextDto, userId: string) {
    try {
      this.logger.log(`Creating podcast from text for user: ${userId}`);

      // 1. Generate audio from text (clean version without markup)
      const cleanTextForAudio = dto.textContent.replace(/\[([^\]]+)\]/g, '$1'); // Remove brackets but keep words
      const audioResult = await this.generateAudioFromText(
        cleanTextForAudio,
        dto.voiceType,
        dto.speechSpeed
      );

      // 2. Create podcast entry
      const podcastData = {
        title: dto.title,
        description: dto.description || `Auto-generated listening practice from text content`,
        audioUrl: audioResult.audioUrl,
        duration: audioResult.duration,
        transcript: cleanTextForAudio, // Store clean version
        category: dto.category,
        difficulty: dto.difficulty,
        source: 'text_to_speech' as any,
        tags: dto.tags || [],
        status: 'published' as any,
        code : new Date().getTime().toString(),
      };

      const podcast = await this.podcastService.create(podcastData, userId);

      // 3. Auto-generate fill blank activity (only type supported)
      const activity = await this.generateFillBlankActivity(
        podcast.id,
        dto.textContent,
        dto.numberOfBlanks || 5,
        dto.questionDifficulty || 'medium',
        userId
      );

      return {
        podcast,
        activity,
        audioGeneration: {
          success: true,
          audioUrl: audioResult.audioUrl,
          duration: audioResult.duration,
        },
      };
    } catch (error) {
      this.logger.error('Error creating podcast from text:', error);
      throw new BadRequestException('Failed to create podcast from text');
    }
  }

  async generateActivitiesOnly(dto: GenerateActivitiesDto, userId: string) {
    try {
      // Get podcast to extract transcript
      const podcast = await this.podcastService.findOne(dto.podcastId, userId);

      if (!podcast.transcriptUrl) {
        throw new BadRequestException('Podcast must have transcript to generate activities');
      }

      const activity = await this.generateFillBlankActivity(
        dto.podcastId,
        podcast.transcriptUrl,
        dto.numberOfQuestions || 5,
        dto.questionDifficulty || 'medium',
        userId
      );

      return { activity };
    } catch (error) {
      this.logger.error('Error generating activities:', error);
      throw new BadRequestException('Failed to generate activities');
    }
  }

  private async generateAudioFromText(
    text: string,
    voiceType: string,
    speechSpeed: number
  ): Promise<{ audioUrl: string; duration: number }> {
    try {
      // TODO: Integrate with actual TTS service (Google TTS, Azure TTS, etc.)
      // For now, we'll simulate the process

      const filename = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
      const audioPath = path.join(this.uploadsPath, filename);

      // Estimate duration (average speaking rate: 150 words per minute)
      const wordCount = text.split(/\s+/).length;
      const estimatedDuration = Math.ceil((wordCount / 150) * 60 / speechSpeed);

      // TODO: Replace this with actual TTS API call
      this.logger.log(`Simulating TTS generation for ${wordCount} words with voice: ${voiceType}`);

      // Create placeholder audio file (in real implementation, this would be the TTS result)
      await this.createPlaceholderAudio(audioPath);

      const audioUrl = `/uploads/podcasts/${filename}`;

      return {
        audioUrl,
        duration: estimatedDuration,
      };
    } catch (error) {
      this.logger.error('Error generating audio:', error);
      throw new BadRequestException('Failed to generate audio from text');
    }
  }

  private async generateFillBlankActivity(
    podcastId: string,
    transcript: string,
    numberOfBlanks: number,
    difficulty: 'easy' | 'medium' | 'hard',
    userId: string
  ) {
    const activityData = await this.generateFillBlank(transcript, numberOfBlanks, difficulty);

    const activity = await this.activityService.create({
      title: activityData.title,
      description: activityData.description,
      podcastId,
      type: PodcastActivityType.FILL_BLANK,
      content: activityData.content,
      points: this.getPointsByDifficulty(difficulty),
    }, userId);

    return activity;
  }

  private async generateFillBlank(
    transcript: string,
    numberOfBlanks: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ) {
    // Check if user manually marked words for blanking using [word] syntax
    const hasManualBlanks = /\[([^\]]+)\]/g.test(transcript);

    if (hasManualBlanks) {
      return this.generateManualFillBlank(transcript);
    } else {
      return this.generateAutoFillBlank(transcript, numberOfBlanks, difficulty);
    }
  }

  private async generateManualFillBlank(transcript: string) {
    const questions = [];
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 5);
    let questionId = 1;

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence.includes('[')) continue;

      // Extract words marked for blanking: [word] -> word
      const blankedWords = [];
      let sentenceWithBlanks = trimmedSentence;

      // Find all [word] patterns
      const matches = trimmedSentence.match(/\[([^\]]+)\]/g);
      if (!matches) continue;

      matches.forEach(match => {
        const word = match.slice(1, -1); // Remove [ and ]
        blankedWords.push(word);
        sentenceWithBlanks = sentenceWithBlanks.replace(match, '___');
      });

      if (blankedWords.length > 0) {
        questions.push({
          id: `blank_${questionId++}`,
          sentence: sentenceWithBlanks,
          correctAnswers: blankedWords,
        });
      }
    }

    return {
      title: `Fill in the Blanks - User Selected`,
      description: `Listen to the audio and fill in the missing words (${questions.length} questions)`,
      content: {
        type: 'fill_blank' as const,
        totalQuestions: questions.length,
        questions,
      },
    };
  }

  private async generateAutoFillBlank(
    transcript: string,
    numberOfBlanks: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ) {
    // Original auto-generation logic
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);

    if (sentences.length < numberOfBlanks) {
      throw new BadRequestException('Not enough content to generate the requested number of blanks');
    }

    const questions = [];
    const usedSentences = new Set();

    for (let i = 0; i < numberOfBlanks && questions.length < numberOfBlanks; i++) {
      let sentence;
      let attempts = 0;

      do {
        sentence = sentences[Math.floor(Math.random() * sentences.length)];
        attempts++;
      } while (usedSentences.has(sentence) && attempts < 10);

      if (usedSentences.has(sentence)) continue;
      usedSentences.add(sentence);

      const words = sentence.trim().split(/\s+/);
      if (words.length < 4) continue;

      // Select word(s) to blank out based on difficulty
      const blanksInSentence = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1 : 2;
      const blankPositions = this.selectBlankPositions(words, blanksInSentence);

      const correctAnswers = blankPositions.map(pos => words[pos]);
      let sentenceWithBlanks = sentence.trim();

      // Replace from right to left to maintain positions
      blankPositions.sort((a, b) => b - a).forEach(() => {
        const pos = blankPositions[0]; // Simple: just blank the first selected word
        const wordToReplace = words[pos];
        sentenceWithBlanks = sentenceWithBlanks.replace(wordToReplace, '___');
      });

      questions.push({
        id: `blank_${i + 1}`,
        sentence: sentenceWithBlanks,
        correctAnswers: [correctAnswers[0]], // Single answer for simplicity
      });
    }

    return {
      title: `Fill in the Blanks - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`,
      description: `Listen to the audio and fill in the missing words (${numberOfBlanks} questions)`,
      content: {
        type: 'fill_blank' as const,
        totalQuestions: questions.length,
        questions,
      },
    };
  }

  private selectBlankPositions(words: string[], numberOfBlanks: number): number[] {
    // Avoid blanking common words like articles, prepositions
    const skipWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const availablePositions = words
      .map((word, index) => ({ word: word.toLowerCase(), index }))
      .filter(({ word }) => !skipWords.includes(word) && word.length > 2)
      .map(({ index }) => index);

    if (availablePositions.length < numberOfBlanks) {
      // If not enough good words, include some shorter words
      return availablePositions.slice(0, numberOfBlanks);
    }

    // Randomly select positions
    const selected = [];
    const available = [...availablePositions];

    for (let i = 0; i < numberOfBlanks && available.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * available.length);
      selected.push(available.splice(randomIndex, 1)[0]);
    }

    return selected.sort((a, b) => a - b);
  }

  private getPointsByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): number {
    switch (difficulty) {
      case 'easy': return 5;
      case 'medium': return 10;
      case 'hard': return 15;
      default: return 10;
    }
  }

  private async createPlaceholderAudio(audioPath: string): Promise<void> {
    // Create empty placeholder file (in real implementation, this would be actual audio)
    fs.writeFileSync(audioPath, Buffer.from('placeholder audio content'));
  }
}
