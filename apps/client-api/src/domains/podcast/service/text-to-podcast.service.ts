import { PrismaRepository } from '@app/database';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
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

      // 1. Generate audio from text
      const audioResult = await this.generateAudioFromText(
        dto.textContent,
        dto.voiceType,
        dto.speechSpeed
      );

      // 2. Create podcast entry
      const podcastData = {
        title: dto.title,
        description: dto.description || `Auto-generated from text content`,
        audioUrl: audioResult.audioUrl,
        duration: audioResult.duration,
        transcript: dto.textContent,
        category: dto.category,
        difficulty: dto.difficulty,
        source: 'text_to_speech' as any,
        tags: dto.tags || [],
        status: 'published' as any,
      };

      const podcast = await this.podcastService.create(podcastData, userId);

      // 3. Generate activities if requested
      if (dto.autoGenerateActivities) {
        const activitiesResult = await this.generateActivitiesForPodcast(
          podcast.id,
          dto.textContent,
          dto.activityTypes,
          dto.numberOfBlanks,
          dto.questionDifficulty,
          userId
        );

        return {
          podcast,
          activities: activitiesResult,
          audioGeneration: {
            success: true,
            audioUrl: audioResult.audioUrl,
            duration: audioResult.duration,
          },
        };
      }

      return {
        podcast,
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

      if (!podcast.transcript) {
        throw new BadRequestException('Podcast must have transcript to generate activities');
      }

      const activities = await this.generateActivitiesForPodcast(
        dto.podcastId,
        podcast.transcript,
        dto.activityTypes,
        dto.numberOfQuestions,
        dto.questionDifficulty,
        userId
      );

      return { activities };
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

  private async generateActivitiesForPodcast(
    podcastId: string,
    transcript: string,
    activityTypes: string[],
    numberOfQuestions: number,
    difficulty: 'easy' | 'medium' | 'hard',
    userId: string
  ) {
    const activities = [];

    for (const activityType of activityTypes) {
      let activityData;

      switch (activityType) {
        case 'fill_in_blanks':
          activityData = await this.generateFillInBlanks(transcript, numberOfQuestions, difficulty);
          break;
        case 'multiple_choice':
          activityData = await this.generateMultipleChoice(transcript, numberOfQuestions, difficulty);
          break;
        case 'true_false':
          activityData = await this.generateTrueFalse(transcript, numberOfQuestions, difficulty);
          break;
        case 'comprehension':
          activityData = await this.generateComprehension(transcript, numberOfQuestions, difficulty);
          break;
        default:
          continue;
      }

      if (activityData) {
        const activity = await this.activityService.create({
          title: activityData.title,
          description: activityData.description,
          podcastId,
          type: activityType as any,
          content: activityData.content,
          points: this.getPointsByDifficulty(difficulty),
          isRequired: activityType === 'fill_in_blanks', // Make fill-in-blanks required
        }, userId);

        activities.push(activity);
      }
    }

    return activities;
  }

  private async generateFillInBlanks(
    transcript: string,
    numberOfBlanks: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ) {
    // Split transcript into sentences
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
      const blanksInSentence = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
      const blankPositions = this.selectBlankPositions(words, blanksInSentence);

      const correctAnswers = blankPositions.map(pos => words[pos]);
      let sentenceWithBlanks = sentence.trim();

      // Replace from right to left to maintain positions
      blankPositions.sort((a, b) => b - a).forEach((pos, index) => {
        const wordToReplace = words[pos];
        sentenceWithBlanks = sentenceWithBlanks.replace(
          wordToReplace,
          `___${blankPositions.length - index}___`
        );
      });

      questions.push({
        id: `blank_${i + 1}`,
        sentence: sentenceWithBlanks,
        correctAnswers,
        blanks: blankPositions.length,
      });
    }

    return {
      title: `Fill in the Blanks - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`,
      description: `Listen to the audio and fill in the missing words (${numberOfBlanks} questions)`,
      content: {
        type: 'fill_in_blanks',
        instructions: 'Listen carefully and fill in the missing words in each sentence.',
        questions,
        totalQuestions: questions.length,
      },
    };
  }

  private async generateMultipleChoice(
    transcript: string,
    numberOfQuestions: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ) {
    // TODO: Implement multiple choice generation
    return {
      title: `Multiple Choice - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`,
      description: `Answer multiple choice questions about the audio content`,
      content: {
        type: 'multiple_choice',
        instructions: 'Listen to the audio and choose the correct answer.',
        questions: [],
        totalQuestions: 0,
      },
    };
  }

  private async generateTrueFalse(
    transcript: string,
    numberOfQuestions: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ) {
    // TODO: Implement true/false generation
    return {
      title: `True or False - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`,
      description: `Determine if statements about the audio are true or false`,
      content: {
        type: 'true_false',
        instructions: 'Listen to the audio and decide if each statement is true or false.',
        questions: [],
        totalQuestions: 0,
      },
    };
  }

  private async generateComprehension(
    transcript: string,
    numberOfQuestions: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ) {
    // TODO: Implement comprehension questions
    return {
      title: `Comprehension Questions - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`,
      description: `Answer questions about the main ideas and details`,
      content: {
        type: 'comprehension',
        instructions: 'Listen to the audio and answer the comprehension questions.',
        questions: [],
        totalQuestions: 0,
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
