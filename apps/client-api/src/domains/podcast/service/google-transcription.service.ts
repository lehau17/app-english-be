import { SpeechClient } from '@google-cloud/speech';
import type { google } from '@google-cloud/speech/build/protos/protos';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

export interface GoogleTranscriptionResult {
  transcript: string;
  confidence: number;
  duration: number; // seconds
  success: boolean;
  error?: string;
}

/**
 * Google Cloud Speech-to-Text service for video transcription
 *
 * Advantages over Whisper:
 * - Runs on Google Cloud (no local CPU needed)
 * - Much faster (10-30s for 3-min audio)
 * - Very accurate
 *
 * Cost: ~$0.024/minute (~$0.07 for 3-min video)
 * Free tier: 60 minutes/month
 *
 * Setup:
 * 1. Create Google Cloud project
 * 2. Enable Speech-to-Text API
 * 3. Create service account & download JSON key
 * 4. Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 */
@Injectable()
export class GoogleTranscriptionService {
  private readonly logger = new Logger(GoogleTranscriptionService.name);
  private readonly client: SpeechClient;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const credentialsPath = this.configService.get<string>(
      'GOOGLE_APPLICATION_CREDENTIALS',
    );

    if (credentialsPath && fs.existsSync(credentialsPath)) {
      this.client = new SpeechClient();
      this.enabled = true;
      this.logger.log('Google Speech-to-Text initialized successfully');
      this.logger.log(`Credentials: ${credentialsPath}`);
    } else {
      this.enabled = false;
      this.logger.warn(
        'Google Speech-to-Text disabled: GOOGLE_APPLICATION_CREDENTIALS not set or file not found',
      );
      this.logger.warn(
        'Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json to enable',
      );
    }
  }

  /**
   * Check if Google STT is available
   */
  isAvailable(): boolean {
    return this.enabled;
  }

  /**
   * Transcribe audio file to text using Google Speech-to-Text
   *
   * @param audioPath Path to audio file (WAV, MP3, FLAC)
   * @param languageCode Language code (default: en-US)
   * @returns Transcription result
   */
  async transcribe(
    audioPath: string,
    languageCode: string = 'en-US',
  ): Promise<GoogleTranscriptionResult> {
    const startTime = Date.now();

    if (!this.enabled) {
      return {
        transcript: '',
        confidence: 0,
        duration: 0,
        success: false,
        error:
          'Google Speech-to-Text not configured. Set GOOGLE_APPLICATION_CREDENTIALS.',
      };
    }

    try {
      // Validate file exists
      if (!fs.existsSync(audioPath)) {
        throw new Error(`File not found: ${audioPath}`);
      }

      const fileSize = fs.statSync(audioPath).size;
      const fileSizeMB = fileSize / (1024 * 1024);

      this.logger.log(`Transcribing with Google STT: ${audioPath}`);
      this.logger.log(`  File size: ${fileSizeMB.toFixed(2)} MB`);
      this.logger.log(`  Language: ${languageCode}`);

      // Read audio file
      const audioBytes = await readFile(audioPath);

      // Determine encoding from file extension
      const extension = audioPath.split('.').pop()?.toLowerCase();
      let encoding: google.cloud.speech.v1.RecognitionConfig.AudioEncoding;

      switch (extension) {
        case 'wav':
          encoding = 'LINEAR16' as any;
          break;
        case 'mp3':
          encoding = 'MP3' as any;
          break;
        case 'flac':
          encoding = 'FLAC' as any;
          break;
        default:
          encoding = 'LINEAR16' as any;
      }

      // Configure request
      const config: google.cloud.speech.v1.IRecognitionConfig = {
        encoding,
        sampleRateHertz: 16000, // Adjust if needed
        languageCode,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        enableWordConfidence: true,
        model: 'latest_long', // Best for long-form content
        useEnhanced: true, // Use enhanced model (better quality)
      };

      const audio = {
        content: audioBytes.toString('base64'),
      };

      const request = {
        config,
        audio,
      };

      // Call Google Cloud Speech API
      this.logger.log('Sending to Google Speech-to-Text API...');
      const [response] = await this.client.recognize(request);

      const processingTime = (Date.now() - startTime) / 1000;

      // Process results
      if (!response.results || response.results.length === 0) {
        this.logger.warn('No speech detected in audio');
        return {
          transcript: '',
          confidence: 0,
          duration: processingTime,
          success: false,
          error: 'No speech detected',
        };
      }

      // Combine all results
      const transcripts: string[] = [];
      let totalConfidence = 0;
      let resultCount = 0;

      for (const result of response.results) {
        const alternative = result.alternatives?.[0];
        if (alternative?.transcript) {
          transcripts.push(alternative.transcript);
          totalConfidence += alternative.confidence || 0;
          resultCount++;
        }
      }

      const transcript = transcripts.join(' ').trim();
      const avgConfidence = resultCount > 0 ? totalConfidence / resultCount : 0;

      this.logger.log(
        `Transcription completed in ${processingTime.toFixed(2)}s`,
      );
      this.logger.log(`  Transcript: ${transcript.substring(0, 100)}...`);
      this.logger.log(`  Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      this.logger.log(`  Words: ${transcript.split(/\s+/).length}`);

      return {
        transcript,
        confidence: avgConfidence,
        duration: processingTime,
        success: true,
      };
    } catch (error) {
      const processingTime = (Date.now() - startTime) / 1000;

      this.logger.error('Google STT transcription failed:', error);

      // Check for specific errors
      let errorMessage = error.message || 'Unknown error';

      if (error.code === 7) {
        errorMessage =
          'Permission denied. Check GOOGLE_APPLICATION_CREDENTIALS.';
      } else if (error.code === 3) {
        errorMessage = 'Invalid audio format or corrupt file.';
      } else if (error.code === 16) {
        errorMessage = 'Authentication failed. Check service account key.';
      } else if (error.message?.includes('quota')) {
        errorMessage = 'API quota exceeded. Check Google Cloud billing.';
      }

      return {
        transcript: '',
        confidence: 0,
        duration: processingTime,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Transcribe long audio (> 1 minute) using async recognition
   * Better for long videos but requires Cloud Storage
   *
   * @param audioGcsUri Google Cloud Storage URI (gs://bucket/file.wav)
   * @param languageCode Language code
   */
  async transcribeLongAudio(
    audioGcsUri: string,
    languageCode: string = 'en-US',
  ): Promise<GoogleTranscriptionResult> {
    if (!this.enabled) {
      return {
        transcript: '',
        confidence: 0,
        duration: 0,
        success: false,
        error: 'Google Speech-to-Text not configured',
      };
    }

    try {
      this.logger.log(`Starting long audio transcription: ${audioGcsUri}`);

      const config: google.cloud.speech.v1.IRecognitionConfig = {
        encoding: 'LINEAR16' as any,
        sampleRateHertz: 16000,
        languageCode,
        enableAutomaticPunctuation: true,
        model: 'latest_long',
        useEnhanced: true,
      };

      const audio = {
        uri: audioGcsUri,
      };

      const request = {
        config,
        audio,
      };

      // Long running recognize
      const [operation] = await this.client.longRunningRecognize(request);
      this.logger.log(
        'Long running operation started, waiting for completion...',
      );

      // Wait for completion
      const [response] = await operation.promise();

      // Process results (same as regular transcribe)
      const transcripts: string[] = [];
      let totalConfidence = 0;
      let resultCount = 0;

      if (response.results) {
        for (const result of response.results) {
          const alternative = result.alternatives?.[0];
          if (alternative?.transcript) {
            transcripts.push(alternative.transcript);
            totalConfidence += alternative.confidence || 0;
            resultCount++;
          }
        }
      }

      const transcript = transcripts.join(' ').trim();
      const avgConfidence = resultCount > 0 ? totalConfidence / resultCount : 0;

      this.logger.log('Long audio transcription completed');
      this.logger.log(`  Transcript: ${transcript.substring(0, 100)}...`);

      return {
        transcript,
        confidence: avgConfidence,
        duration: 0,
        success: true,
      };
    } catch (error) {
      this.logger.error('Long audio transcription failed:', error);
      return {
        transcript: '',
        confidence: 0,
        duration: 0,
        success: false,
        error: error.message,
      };
    }
  }
}
