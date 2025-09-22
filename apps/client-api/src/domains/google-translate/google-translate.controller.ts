import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiQuery,
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

  // ============== VIETNAMESE-SPECIFIC ENDPOINTS ==============

  @Post('vietnamese/pronunciation-analysis')
  @ApiOperation({
    summary: 'Phân tích phát âm tiếng Việt',
    description: 'Tạo hướng dẫn phát âm chi tiết cho văn bản tiếng Việt',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Văn bản tiếng Việt cần phân tích',
          example: 'Xin chào, tôi học tiếng Việt',
        },
      },
      required: ['text'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Phân tích phát âm thành công',
    schema: {
      type: 'object',
      properties: {
        originalText: { type: 'string' },
        phoneticGuide: { type: 'array' },
        tonalAnalysis: { type: 'string' },
        difficulty: { type: 'object' },
        suggestions: { type: 'array' },
        audioUrl: { type: 'string' },
      },
    },
  })
  async analyzeVietnamesePronunciation(@Body() body: { text: string }) {
    const { text } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    return this.googleTranslateFreeService.analyzeVietnameseForPronunciation(
      text,
    );
  }

  @Post('vietnamese/regional-audio')
  @ApiOperation({
    summary: 'Tạo audio tiếng Việt theo phương ngữ',
    description: 'Tạo audio với phương ngữ miền Bắc, Trung, Nam',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Văn bản tiếng Việt',
          example: 'Tôi đang học tiếng Việt',
        },
        region: {
          type: 'string',
          enum: ['north', 'central', 'south'],
          description: 'Phương ngữ miền',
          example: 'north',
        },
      },
      required: ['text'],
    },
  })
  async createRegionalVietnameseAudio(
    @Body() body: { text: string; region?: 'north' | 'central' | 'south' },
  ) {
    const { text, region = 'north' } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    return this.googleTranslateFreeService.createVietnameseAudioWithRegionalAccent(
      text,
      region,
    );
  }

  @Post('vietnamese/fill-blank-exercise')
  @ApiOperation({
    summary: 'Tạo bài tập điền từ tiếng Việt',
    description: 'Tự động tạo bài tập điền từ từ văn bản tiếng Việt',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Văn bản tiếng Việt để tạo bài tập',
          example:
            'Việt Nam là một quốc gia có nền văn hóa lâu đời và truyền thống tốt đẹp',
        },
      },
      required: ['text'],
    },
  })
  async generateVietnameseFillBlank(@Body() body: { text: string }) {
    const { text } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    return this.googleTranslateFreeService.generateVietnameseFillBlankExercise(
      text,
    );
  }

  @Post('vietnamese/grammar-quiz')
  @ApiOperation({
    summary: 'Tạo quiz ngữ pháp tiếng Việt',
    description: 'Tự động tạo câu hỏi trắc nghiệm về ngữ pháp tiếng Việt',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Văn bản tiếng Việt để tạo quiz',
          example:
            'Kính thưa quý khách, chúng tôi xin thông báo về chương trình học mới',
        },
      },
      required: ['text'],
    },
  })
  async generateVietnameseGrammarQuiz(@Body() body: { text: string }) {
    const { text } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    return this.googleTranslateFreeService.generateVietnameseGrammarQuiz(text);
  }

  @Post('vietnamese/vocabulary-audio')
  @ApiOperation({
    summary: 'Tạo audio học từ vựng tiếng Việt',
    description: 'Tạo audio phát âm từng từ với tốc độ có thể điều chỉnh',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        words: {
          type: 'array',
          items: { type: 'string' },
          description: 'Danh sách từ vựng tiếng Việt',
          example: ['học', 'tập', 'nói', 'nghe', 'đọc', 'viết'],
        },
        speed: {
          type: 'string',
          enum: ['slow', 'normal', 'fast'],
          description: 'Tốc độ đọc',
          example: 'normal',
        },
        includeDefinitions: {
          type: 'boolean',
          description: 'Có bao gồm nghĩa của từ không',
          example: true,
        },
      },
      required: ['words'],
    },
  })
  async createVietnameseVocabularyAudio(
    @Body()
    body: {
      words: string[];
      speed?: 'slow' | 'normal' | 'fast';
      includeDefinitions?: boolean;
    },
  ) {
    const { words, speed = 'normal', includeDefinitions = false } = body;

    if (!words || words.length === 0) {
      throw new BadRequestException(
        'Words array is required and cannot be empty',
      );
    }

    return this.googleTranslateFreeService.createVietnameseVocabularyAudio(
      words,
      { speed, includeDefinitions },
    );
  }

  @Post('vietnamese/listening-exercise')
  @ApiOperation({
    summary: 'Tạo bài tập nghe tiếng Việt',
    description: 'Tạo bài tập nghe hiểu từ văn bản tiếng Việt',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Văn bản tiếng Việt để tạo bài tập nghe',
          example:
            'Hà Nội là thủ đô của Việt Nam. Thành phố này có nhiều di tích lịch sử nổi tiếng.',
        },
      },
      required: ['text'],
    },
  })
  async createVietnameseListeningExercise(@Body() body: { text: string }) {
    const { text } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    return this.googleTranslateFreeService.createVietnameseListeningExercise(
      text,
    );
  }
}
