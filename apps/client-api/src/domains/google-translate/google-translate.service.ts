import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Translate } from '@google-cloud/translate/build/src/v2';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendFileSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';
import { join } from 'path';
import { UploadService } from '../upload/upload.service';

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

  constructor(private readonly uploadService?: UploadService) {}

  /**
   * Tạo audio từ văn bản sử dụng Google Translate TTS miễn phí
   */
  async createAudioFile(text: string, language: string = 'en'): Promise<string> {
    // Google Translate TTS rejects very long `q` parameters. Split text into safe chunks
    // (try to keep each chunk under ~200 characters) and fetch each segment, appending
    // the resulting MP3 bytes into a single file.
    const options = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'audio/mpeg',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://translate.google.com/',
      },
    };

    const maxChunkLength = 200;

    const splitTextToChunks = (input: string, maxLen: number) => {
      const sentences = input.split(/(?<=[.!?])\s+/);
      const chunks: string[] = [];

      for (const sentence of sentences) {
        if (!sentence) continue;
        if (sentence.length <= maxLen) {
          // try to merge into previous chunk if possible
          const last = chunks.at(-1);
          if (last && (last.length + 1 + sentence.length) <= maxLen) {
            chunks[chunks.length - 1] = `${last} ${sentence}`;
          } else {
            chunks.push(sentence);
          }
        } else {
          // sentence too long, split on spaces
          const words = sentence.split(' ');
          let cur = '';
          for (const w of words) {
            if ((cur + ' ' + w).trim().length > maxLen) {
              if (cur) chunks.push(cur.trim());
              cur = w;
            } else {
              cur = (cur + ' ' + w).trim();
            }
          }
          if (cur) chunks.push(cur.trim());
        }
      }

      // Fallback: if still empty, push the original input
      if (chunks.length === 0) chunks.push(input);
      return chunks;
    };

    // Create safe file name and ensure directory exists
    const safeText = text.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const fileName = `${safeText}-${Date.now()}.mp3`;
    const dirPath = join(process.cwd(), 'uploads', 'audio');
    try {
      mkdirSync(dirPath, { recursive: true });
    } catch (e) {
      // ignore mkdir errors, we'll surface them later if writes fail
    }

    const filePath = join(dirPath, fileName);

    try {
      const chunks = splitTextToChunks(text, maxChunkLength);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${language}&client=tw-ob`;

        const response = await fetch(url, options as any);

        if (!response.ok) {
          // try to get text body for easier debugging
          let bodyText = '';
          try {
            bodyText = await response.text();
          } catch (e) {
            bodyText = '<non-text response>';
          }
          this.logger.error(`TTS request failed for chunk ${i} status=${response.status} body=${bodyText}`);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const arrayBuf = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        if (i === 0) {
          // write first chunk (overwrite if exists)
          writeFileSync(filePath, buffer);
        } else {
          // append subsequent chunks
          appendFileSync(filePath, buffer);
        }
      }

      this.logger.log(`Audio file created: ${filePath}`);
      return filePath;
    } catch (error) {
      // Remove partially written file on error
      try {
        unlinkSync(filePath);
      } catch (e) {
        // ignore
      }
      this.logger.error('Error creating audio file:', error);
      throw new Error('Failed to create audio file');
    }
  }

  /**
   * Tạo audio và trả về URL công khai
   */
  async createAudioWithUrl(text: string, language: string = 'en'): Promise<{ filePath: string; url: string }> {
    const filePath = await this.createAudioFile(text, language);

    // If UploadService is available, upload the generated file to S3 (MinIO) and return that URL
    try {
      if (this.uploadService) {
        // Read file into buffer
        const buffer = readFileSync(filePath);
        // Create a Multer-like object for uploadService.uploadFile
        const fileObj: any = {
          buffer,
          mimetype: 'audio/mpeg',
          originalname: path.basename(filePath),
        };

        const s3Url = await this.uploadService.uploadFile(fileObj);

        // Cleanup local file
        try {
          unlinkSync(filePath);
        } catch (e) {
          this.logger.warn('Failed to remove temp audio file:', e);
        }

        return { filePath, url: s3Url };
      }
    } catch (e) {
      this.logger.error('Failed to upload audio to S3:', e);
    }

    // Fallback: return local URL
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
