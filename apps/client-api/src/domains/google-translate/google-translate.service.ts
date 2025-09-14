import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Translate } from '@google-cloud/translate/build/src/v2';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'fs';
import fetch from 'node-fetch';
import { join } from 'path';

@Injectable()
export class GoogleTranslateService {
  private readonly translateClient: Translate;
  private readonly ttsClient: TextToSpeechClient;

  constructor(private readonly configService: ConfigService) {
    // Khởi tạo Google Translate client
    this.translateClient = new Translate({
      projectId: this.configService.getOrThrow<string>('GOOGLE_CLOUD_PROJECT_ID'),
      keyFilename: this.configService.getOrThrow<string>('GOOGLE_CLOUD_KEY_FILE'),
    });

    // Khởi tạo Text-to-Speech client
    this.ttsClient = new TextToSpeechClient({
      projectId: this.configService.getOrThrow<string>('GOOGLE_CLOUD_PROJECT_ID'),
      keyFilename: this.configService.getOrThrow<string>('GOOGLE_CLOUD_KEY_FILE'),
    });
  }

  /**
   * Dịch văn bản từ ngôn ngữ nguồn sang ngôn ngữ đích
   */
  async translateText(text: string, targetLanguage: string, sourceLanguage?: string) {
    try {
      const [translation] = await this.translateClient.translate(text, {
        from: sourceLanguage,
        to: targetLanguage,
      });

      return {
        originalText: text,
        translatedText: translation,
        sourceLanguage: sourceLanguage || 'auto',
        targetLanguage,
      };
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error('Failed to translate text');
    }
  }

  /**
   * Phát hiện ngôn ngữ của văn bản
   */
  async detectLanguage(text: string) {
    try {
      const [detection] = await this.translateClient.detect(text);
      return {
        language: detection.language,
        confidence: detection.confidence,
      };
    } catch (error) {
      console.error('Language detection error:', error);
      throw new Error('Failed to detect language');
    }
  }

  /**
   * Chuyển văn bản thành audio (Text-to-Speech)
   */
  async textToSpeech(text: string, languageCode: string = 'en-US', voiceName?: string) {
    try {
      const request = {
        input: { text },
        voice: {
          languageCode,
          name: voiceName || `${languageCode}-Standard-A`, // Voice mặc định
        },
        audioConfig: {
          audioEncoding: 'MP3' as const,
          speakingRate: 1.0,
          pitch: 0.0,
        },
      };

      const [response] = await this.ttsClient.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content received');
      }

      return {
        audioContent: response.audioContent,
        languageCode,
        text,
      };
    } catch (error) {
      console.error('Text-to-speech error:', error);
      throw new Error('Failed to generate audio');
    }
  }

  /**
   * Dịch văn bản và tạo audio cho bản dịch
   */
  async translateAndGenerateAudio(text: string, targetLanguage: string, sourceLanguage?: string) {
    try {
      // Bước 1: Dịch văn bản
      const translation = await this.translateText(text, targetLanguage, sourceLanguage);

      // Bước 2: Tạo audio cho bản dịch
      const audio = await this.textToSpeech(translation.translatedText, targetLanguage);

      return {
        ...translation,
        audioContent: audio.audioContent,
        audioLanguage: targetLanguage,
      };
    } catch (error) {
      console.error('Translate and generate audio error:', error);
      throw new Error('Failed to translate and generate audio');
    }
  }

  /**
   * Lấy danh sách ngôn ngữ được hỗ trợ
   */
  async getSupportedLanguages() {
    try {
      const [languages] = await this.translateClient.getLanguages();
      return languages.map(lang => ({
        code: lang.code,
        name: lang.name,
      }));
    } catch (error) {
      console.error('Get supported languages error:', error);
      throw new Error('Failed to get supported languages');
    }
  }

  /**
   * Lấy danh sách voices có sẵn cho Text-to-Speech
   */
  async getAvailableVoices(languageCode?: string) {
    try {
      const [result] = await this.ttsClient.listVoices({
        languageCode,
      });

      return result.voices?.map(voice => ({
        name: voice.name,
        languageCodes: voice.languageCodes,
        ssmlGender: voice.ssmlGender,
        naturalSampleRateHertz: voice.naturalSampleRateHertz,
      })) || [];
    } catch (error) {
      console.error('Get available voices error:', error);
      throw new Error('Failed to get available voices');
    }
  }
}

@Injectable()
export class GoogleTranslateFreeService {
  private readonly logger = new Logger(GoogleTranslateFreeService.name);

  /**
   * Tạo audio từ văn bản sử dụng Google Translate TTS miễn phí
   */
  async createAudioFile(text: string, language: string = 'en'): Promise<string> {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${language}&client=tw-ob`;

    const options = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'audio/mpeg',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://translate.google.com/',
      },
    };

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Tạo tên file an toàn
      const safeText = text.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const fileName = `${safeText}-${Date.now()}.mp3`;
      const filePath = join(process.cwd(), 'uploads', 'audio', fileName);

      const writer = createWriteStream(filePath);

      return new Promise((resolve, reject) => {
        if (!response.body) {
          writer.end(); // Cleanup on error
          reject(new Error('No response body'));
          return;
        }

        const cleanup = (error?: any) => {
          writer.end();
          if (error) {
            // Remove partially written file on error
            try {
              require('fs').unlinkSync(filePath);
            } catch (unlinkError) {
              this.logger.warn('Failed to cleanup partial file:', unlinkError);
            }
          }
        };

        // Handle writer errors
        writer.on('error', (error) => {
          cleanup(error);
          reject(error);
        });

        // Handle stream errors
        response.body.on('error', (error) => {
          cleanup(error);
          reject(error);
        });

        // Pipe response body to file writer
        response.body.pipe(writer);

        writer.on('finish', () => {
          this.logger.log(`Audio file created: ${filePath}`);
          resolve(filePath);
        });

        writer.on('error', (error) => {
          cleanup(error);
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error('Error creating audio file:', error);
      throw new Error('Failed to create audio file');
    }
  }

  /**
   * Tạo audio và trả về URL công khai
   */
  async createAudioWithUrl(text: string, language: string = 'en'): Promise<{ filePath: string; url: string }> {
    const filePath = await this.createAudioFile(text, language);

    // Chuyển đổi file path thành URL công khai
    const relativePath = filePath.replace(process.cwd(), '');
    const url = `${process.env.APP_URL || 'http://localhost:3000'}${relativePath.replace(/\\/g, '/')}`;

    return { filePath, url };
  }

  /**
   * Tạo audio cho nhiều ngôn ngữ
   */
  async createAudioForMultipleLanguages(text: string, languages: string[] = ['en', 'vi', 'es']): Promise<{ [key: string]: string }> {
    const results: { [key: string]: string } = {};

    for (const lang of languages) {
      try {
        const { url } = await this.createAudioWithUrl(text, lang);
        results[lang] = url;
      } catch (error) {
        this.logger.error(`Failed to create audio for ${lang}:`, error);
        results[lang] = null;
      }
    }

    return results;
  }

  /**
   * Kiểm tra xem ngôn ngữ có được hỗ trợ không
   */
  isLanguageSupported(language: string): boolean {
    const supportedLanguages = [
      'af', 'ar', 'bn', 'bs', 'ca', 'cs', 'cy', 'da', 'de', 'el', 'en', 'eo', 'es', 'et', 'fi', 'fr',
      'hi', 'hr', 'hu', 'hy', 'id', 'is', 'it', 'ja', 'jw', 'km', 'ko', 'la', 'lv', 'mk', 'ml', 'mr',
      'ms', 'my', 'ne', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'si', 'sk', 'sq', 'sr', 'su', 'sv', 'sw',
      'ta', 'te', 'th', 'tl', 'tr', 'uk', 'ur', 'vi', 'zh-CN', 'zh-TW'
    ];

    return supportedLanguages.includes(language);
  }
}
