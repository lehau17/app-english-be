import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBody,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import {
    GoogleTranslateFreeService,
    GoogleTranslateService,
} from './google-translate.service';

@ApiTags('Google Translate')
@Controller('/public/v1/google-translate')
export class GoogleTranslateController {
  constructor(
    private readonly googleTranslateService: GoogleTranslateService,
    private readonly googleTranslateFreeService: GoogleTranslateFreeService,
  ) {}

  @Post('translate')
  @ApiOperation({
    summary: 'Dịch văn bản',
    description: 'Dịch văn bản từ ngôn ngữ nguồn sang ngôn ngữ đích',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Văn bản cần dịch',
          example: 'Hello world',
        },
        targetLanguage: {
          type: 'string',
          description: 'Ngôn ngữ đích',
          example: 'vi',
        },
        sourceLanguage: {
          type: 'string',
          description: 'Ngôn ngữ nguồn (tùy chọn)',
          example: 'en',
        },
      },
      required: ['text', 'targetLanguage'],
    },
  })
  @ApiResponse({ status: 200, description: 'Dịch thành công' })
  @ApiResponse({ status: 400, description: 'Thiếu thông tin bắt buộc' })
  async translateText(
    @Body()
    body: {
      text: string;
      targetLanguage: string;
      sourceLanguage?: string;
    },
  ) {
    const { text, targetLanguage, sourceLanguage } = body;

    if (!text || !targetLanguage) {
      throw new BadRequestException('Text and targetLanguage are required');
    }

    return this.googleTranslateService.translateText(
      text,
      targetLanguage,
      sourceLanguage,
    );
  }

  @Post('translate-with-audio')
  @ApiOperation({
    summary: 'Dịch văn bản kèm audio',
    description: 'Dịch văn bản và tạo file âm thanh cho bản dịch',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Văn bản cần dịch',
          example: 'Hello world',
        },
        targetLanguage: {
          type: 'string',
          description: 'Ngôn ngữ đích',
          example: 'vi',
        },
        sourceLanguage: {
          type: 'string',
          description: 'Ngôn ngữ nguồn (tùy chọn)',
          example: 'en',
        },
      },
      required: ['text', 'targetLanguage'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Dịch và tạo audio thành công',
    schema: {
      type: 'object',
      properties: {
        translatedText: { type: 'string', description: 'Văn bản đã dịch' },
        audioContent: { type: 'string', description: 'Audio dưới dạng base64' },
      },
    },
  })
  async translateAndGenerateAudio(
    @Body()
    body: {
      text: string;
      targetLanguage: string;
      sourceLanguage?: string;
    },
  ) {
    const { text, targetLanguage, sourceLanguage } = body;

    if (!text || !targetLanguage) {
      throw new BadRequestException('Text and targetLanguage are required');
    }

    const result = await this.googleTranslateService.translateAndGenerateAudio(
      text,
      targetLanguage,
      sourceLanguage,
    );

    return {
      ...result,
      audioContent: result.audioContent.toString('base64'),
    };
  }

  @Post('text-to-speech')
  @ApiOperation({
    summary: 'Chuyển văn bản thành giọng nói',
    description: 'Tạo file âm thanh từ văn bản',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Văn bản cần chuyển đổi',
          example: 'Hello world',
        },
        languageCode: {
          type: 'string',
          description: 'Mã ngôn ngữ, mặc định en-US',
          example: 'en-US',
        },
        voiceName: {
          type: 'string',
          description: 'Tên giọng đọc (tùy chọn)',
          example: 'en-US-Wavenet-D',
        },
      },
      required: ['text'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Audio được trả về dưới dạng base64',
    schema: {
      type: 'object',
      properties: {
        audioContent: { type: 'string', description: 'Audio base64' },
      },
    },
  })
  async textToSpeech(
    @Body() body: { text: string; languageCode?: string; voiceName?: string },
  ) {
    const { text, languageCode = 'en-US', voiceName } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    const result = await this.googleTranslateService.textToSpeech(
      text,
      languageCode,
      voiceName,
    );

    return {
      ...result,
      audioContent: result.audioContent.toString('base64'),
    };
  }

  @Post('detect-language')
  @ApiOperation({
    summary: 'Nhận diện ngôn ngữ',
    description: 'Xác định ngôn ngữ của đoạn văn bản',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Văn bản cần xác định ngôn ngữ',
          example: 'Xin chào',
        },
      },
      required: ['text'],
    },
  })
  @ApiResponse({ status: 200, description: 'Ngôn ngữ được phát hiện' })
  async detectLanguage(@Body() body: { text: string }) {
    const { text } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    return this.googleTranslateService.detectLanguage(text);
  }

  @Get('supported-languages')
  @ApiOperation({ summary: 'Danh sách ngôn ngữ hỗ trợ (Google Translate API)' })
  @ApiResponse({ status: 200, description: 'Danh sách ngôn ngữ' })
  async getSupportedLanguages() {
    return this.googleTranslateService.getSupportedLanguages();
  }

  @Get('available-voices')
  @ApiOperation({
    summary: 'Danh sách giọng đọc hỗ trợ',
    description: 'Lấy danh sách giọng đọc cho Text-to-Speech',
  })
  @ApiQuery({
    name: 'languageCode',
    required: false,
    description: 'Mã ngôn ngữ (tùy chọn)',
    example: 'en-US',
  })
  async getAvailableVoices(@Query('languageCode') languageCode?: string) {
    return this.googleTranslateService.getAvailableVoices(languageCode);
  }

  @Post('free/text-to-speech')
  @ApiOperation({
    summary: 'Chuyển văn bản thành giọng nói (Free)',
    description: 'Dùng free TTS, trả về file audio',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Văn bản cần chuyển đổi',
          example: 'Hello world',
        },
        language: { type: 'string', description: 'Ngôn ngữ', example: 'en' },
      },
      required: ['text'],
    },
  })
  async createFreeAudioFile(@Body() body: { text: string; language?: string }) {
    const { text, language = 'en' } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    if (!this.googleTranslateFreeService.isLanguageSupported(language)) {
      throw new BadRequestException(`Language '${language}' is not supported`);
    }

    return this.googleTranslateFreeService.createAudioWithUrl(text, language);
  }

  @Post('free/text-to-speech-multiple')
  @ApiOperation({
    summary: 'Chuyển văn bản thành giọng nói nhiều ngôn ngữ (Free)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Văn bản cần chuyển đổi',
          example: 'Hello world',
        },
        languages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Danh sách ngôn ngữ',
          example: ['en', 'vi', 'es'],
        },
      },
      required: ['text'],
    },
  })
  async createFreeAudioMultipleLanguages(
    @Body() body: { text: string; languages?: string[] },
  ) {
    const { text, languages = ['en', 'vi', 'es'] } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    return this.googleTranslateFreeService.createAudioForMultipleLanguages(
      text,
      languages,
    );
  }

  @Post('free/translate')
  @ApiOperation({
    summary: 'Dịch từ với dictionary definitions (Free)',
    description:
      'Dịch từ tiếng Anh sang ngôn ngữ khác kèm phiên âm và định nghĩa',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Từ cần dịch',
          example: 'hello',
        },
        targetLanguage: {
          type: 'string',
          description: 'Ngôn ngữ đích',
          example: 'vi',
        },
      },
      required: ['text', 'targetLanguage'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Dịch thành công với dictionary',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Từ đã dịch' },
        pronunciation: { type: 'string', description: 'Phiên âm (IPA)' },
        definitions: {
          type: 'array',
          description: 'Định nghĩa theo từ loại',
          items: {
            type: 'object',
            properties: {
              partOfSpeech: { type: 'string', description: 'Từ loại' },
              definitions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    definition: { type: 'string' },
                    example: { type: 'string' },
                    synonyms: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  async translateWithDictionary(
    @Body() body: { text: string; targetLanguage: string },
  ) {
    const { text, targetLanguage } = body;

    if (!text || !targetLanguage) {
      throw new BadRequestException('Text and targetLanguage are required');
    }

    return this.googleTranslateFreeService.translateWithDictionary(
      text,
      targetLanguage,
    );
  }

  @Get('free/supported-languages')
  @ApiOperation({ summary: 'Danh sách ngôn ngữ hỗ trợ (Free TTS)' })
  async getFreeSupportedLanguages() {
    const supportedLanguages = [
      'af',
      'ar',
      'bn',
      'bs',
      'ca',
      'cs',
      'cy',
      'da',
      'de',
      'el',
      'en',
      'eo',
      'es',
      'et',
      'fi',
      'fr',
      'hi',
      'hr',
      'hu',
      'hy',
      'id',
      'is',
      'it',
      'ja',
      'jw',
      'km',
      'ko',
      'la',
      'lv',
      'mk',
      'ml',
      'mr',
      'ms',
      'my',
      'ne',
      'nl',
      'no',
      'pl',
      'pt',
      'ro',
      'ru',
      'si',
      'sk',
      'sq',
      'sr',
      'su',
      'sv',
      'sw',
      'ta',
      'te',
      'th',
      'tl',
      'tr',
      'uk',
      'ur',
      'vi',
      'zh-CN',
      'zh-TW',
    ];

    return supportedLanguages.map((code) => ({
      code,
      name: this.getLanguageName(code),
    }));
  }

  private getLanguageName(code: string): string {
    const languageNames: { [key: string]: string } = {
      af: 'Afrikaans',
      ar: 'Arabic',
      bn: 'Bengali',
      bs: 'Bosnian',
      ca: 'Catalan',
      cs: 'Czech',
      cy: 'Welsh',
      da: 'Danish',
      de: 'German',
      el: 'Greek',
      en: 'English',
      eo: 'Esperanto',
      es: 'Spanish',
      et: 'Estonian',
      fi: 'Finnish',
      fr: 'French',
      hi: 'Hindi',
      hr: 'Croatian',
      hu: 'Hungarian',
      hy: 'Armenian',
      id: 'Indonesian',
      is: 'Icelandic',
      it: 'Italian',
      ja: 'Japanese',
      jw: 'Javanese',
      km: 'Khmer',
      ko: 'Korean',
      la: 'Latin',
      lv: 'Latvian',
      mk: 'Macedonian',
      ml: 'Malayalam',
      mr: 'Marathi',
      ms: 'Malay',
      my: 'Myanmar',
      ne: 'Nepali',
      nl: 'Dutch',
      no: 'Norwegian',
      pl: 'Polish',
      pt: 'Portuguese',
      ro: 'Romanian',
      ru: 'Russian',
      si: 'Sinhala',
      sk: 'Slovak',
      sq: 'Albanian',
      sr: 'Serbian',
      su: 'Sundanese',
      sv: 'Swedish',
      sw: 'Swahili',
      ta: 'Tamil',
      te: 'Telugu',
      th: 'Thai',
      tl: 'Filipino',
      tr: 'Turkish',
      uk: 'Ukrainian',
      ur: 'Urdu',
      vi: 'Vietnamese',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
    };

    return languageNames[code] || code;
  }
}
