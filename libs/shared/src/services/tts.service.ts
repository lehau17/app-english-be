import { Injectable, Logger } from '@nestjs/common';

export interface IUploadService {
  uploadBuffer(
    buffer: Buffer,
    filename: string,
    contentType: string,
  ): Promise<{ url: string }>;
}

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  constructor(private readonly uploadService?: IUploadService) {}

  /**
   * Tạo audio từ văn bản sử dụng Google Translate TTS miễn phí
   */
  async createAudioWithUrl(
    text: string,
    language: string = 'en',
  ): Promise<{ url: string }> {
    const options = {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'audio/mpeg',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://translate.google.com/',
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
          if (last && last.length + 1 + sentence.length <= maxLen) {
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
              cur = cur ? cur + ' ' + w : w;
            }
          }
          if (cur) chunks.push(cur.trim());
        }
      }
      return chunks;
    };

    try {
      const chunks = splitTextToChunks(text, maxChunkLength);
      let allAudioBuffer = Buffer.alloc(0);

      for (const chunk of chunks) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${language}&client=tw-ob`;

        const response = await fetch(url, options);

        if (!response.ok) {
          throw new Error(
            `TTS request failed: ${response.status} ${response.statusText}`,
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        const chunkBuffer = Buffer.from(arrayBuffer);

        if (chunkBuffer.length === 0) {
          this.logger.warn(`Empty audio buffer for chunk: "${chunk}"`);
          continue;
        }

        allAudioBuffer = Buffer.concat([allAudioBuffer, chunkBuffer]);
      }

      if (allAudioBuffer.length === 0) {
        throw new Error(
          'Failed to generate audio: all chunks resulted in empty buffers',
        );
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const filename = `tts-${timestamp}-${randomString}.mp3`;

      // Upload to storage and get URL
      const uploadResult = await this.uploadService?.uploadBuffer(
        allAudioBuffer,
        filename,
        'audio/mpeg',
      );

      if (!uploadResult?.url) {
        throw new Error('Failed to upload generated audio file');
      }

      this.logger.debug(
        `Generated TTS audio for "${text}" (${language}): ${uploadResult.url}`,
      );

      return { url: uploadResult.url };
    } catch (error) {
      this.logger.error(
        `Failed to create audio for text "${text}": ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Kiểm tra xem ngôn ngữ có được hỗ trợ không
   */
  isLanguageSupported(language: string): boolean {
    const supportedLanguages = [
      'en',
      'es',
      'fr',
      'de',
      'it',
      'pt',
      'ru',
      'ja',
      'ko',
      'zh',
      'ar',
      'hi',
      'th',
      'vi',
      'id',
      'ms',
      'tl',
      'nl',
      'pl',
      'tr',
    ];

    const lang = language.split('-')[0].toLowerCase();
    return supportedLanguages.includes(lang);
  }
}
