import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GoogleTranslateFreeService, GoogleTranslateService } from './google-translate.service';

@Controller('google-translate')
export class GoogleTranslateController {
  constructor(
    private readonly googleTranslateService: GoogleTranslateService,
    private readonly googleTranslateFreeService: GoogleTranslateFreeService
  ) {}

  @Post('translate')
  async translateText(
    @Body() body: { text: string; targetLanguage: string; sourceLanguage?: string }
  ) {
    const { text, targetLanguage, sourceLanguage } = body;

    if (!text || !targetLanguage) {
      throw new BadRequestException('Text and targetLanguage are required');
    }

    return this.googleTranslateService.translateText(text, targetLanguage, sourceLanguage);
  }

  @Post('translate-with-audio')
  async translateAndGenerateAudio(
    @Body() body: { text: string; targetLanguage: string; sourceLanguage?: string }
  ) {
    const { text, targetLanguage, sourceLanguage } = body;

    if (!text || !targetLanguage) {
      throw new BadRequestException('Text and targetLanguage are required');
    }

    const result = await this.googleTranslateService.translateAndGenerateAudio(
      text,
      targetLanguage,
      sourceLanguage
    );

    // Trả về base64 encoded audio
    return {
      ...result,
      audioContent: result.audioContent.toString('base64'),
    };
  }

  @Post('text-to-speech')
  async textToSpeech(
    @Body() body: { text: string; languageCode?: string; voiceName?: string }
  ) {
    const { text, languageCode = 'en-US', voiceName } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    const result = await this.googleTranslateService.textToSpeech(text, languageCode, voiceName);

    return {
      ...result,
      audioContent: result.audioContent.toString('base64'),
    };
  }

  @Post('detect-language')
  async detectLanguage(@Body() body: { text: string }) {
    const { text } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    return this.googleTranslateService.detectLanguage(text);
  }

  @Get('supported-languages')
  async getSupportedLanguages() {
    return this.googleTranslateService.getSupportedLanguages();
  }

  @Get('available-voices')
  async getAvailableVoices(@Query('languageCode') languageCode?: string) {
    return this.googleTranslateService.getAvailableVoices(languageCode);
  }

  // Free TTS endpoints
  @Post('free/text-to-speech')
  async createFreeAudioFile(
    @Body() body: { text: string; language?: string }
  ) {
    const { text, language = 'en' } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    if (!this.googleTranslateFreeService.isLanguageSupported(language)) {
      throw new BadRequestException(`Language '${language}' is not supported`);
    }

    const result = await this.googleTranslateFreeService.createAudioWithUrl(text, language);
    return result;
  }

  @Post('free/text-to-speech-multiple')
  async createFreeAudioMultipleLanguages(
    @Body() body: { text: string; languages?: string[] }
  ) {
    const { text, languages = ['en', 'vi', 'es'] } = body;

    if (!text) {
      throw new BadRequestException('Text is required');
    }

    const result = await this.googleTranslateFreeService.createAudioForMultipleLanguages(text, languages);
    return result;
  }

  @Get('free/supported-languages')
  async getFreeSupportedLanguages() {
    const supportedLanguages = [
      'af', 'ar', 'bn', 'bs', 'ca', 'cs', 'cy', 'da', 'de', 'el', 'en', 'eo', 'es', 'et', 'fi', 'fr',
      'hi', 'hr', 'hu', 'hy', 'id', 'is', 'it', 'ja', 'jw', 'km', 'ko', 'la', 'lv', 'mk', 'ml', 'mr',
      'ms', 'my', 'ne', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'si', 'sk', 'sq', 'sr', 'su', 'sv', 'sw',
      'ta', 'te', 'th', 'tl', 'tr', 'uk', 'ur', 'vi', 'zh-CN', 'zh-TW'
    ];

    return supportedLanguages.map(code => ({
      code,
      name: this.getLanguageName(code),
    }));
  }

  private getLanguageName(code: string): string {
    const languageNames: { [key: string]: string } = {
      'af': 'Afrikaans', 'ar': 'Arabic', 'bn': 'Bengali', 'bs': 'Bosnian', 'ca': 'Catalan',
      'cs': 'Czech', 'cy': 'Welsh', 'da': 'Danish', 'de': 'German', 'el': 'Greek',
      'en': 'English', 'eo': 'Esperanto', 'es': 'Spanish', 'et': 'Estonian', 'fi': 'Finnish',
      'fr': 'French', 'hi': 'Hindi', 'hr': 'Croatian', 'hu': 'Hungarian', 'hy': 'Armenian',
      'id': 'Indonesian', 'is': 'Icelandic', 'it': 'Italian', 'ja': 'Japanese', 'jw': 'Javanese',
      'km': 'Khmer', 'ko': 'Korean', 'la': 'Latin', 'lv': 'Latvian', 'mk': 'Macedonian',
      'ml': 'Malayalam', 'mr': 'Marathi', 'ms': 'Malay', 'my': 'Myanmar', 'ne': 'Nepali',
      'nl': 'Dutch', 'no': 'Norwegian', 'pl': 'Polish', 'pt': 'Portuguese', 'ro': 'Romanian',
      'ru': 'Russian', 'si': 'Sinhala', 'sk': 'Slovak', 'sq': 'Albanian', 'sr': 'Serbian',
      'su': 'Sundanese', 'sv': 'Swedish', 'sw': 'Swahili', 'ta': 'Tamil', 'te': 'Telugu',
      'th': 'Thai', 'tl': 'Filipino', 'tr': 'Turkish', 'uk': 'Ukrainian', 'ur': 'Urdu',
      'vi': 'Vietnamese', 'zh-CN': 'Chinese (Simplified)', 'zh-TW': 'Chinese (Traditional)'
    };

    return languageNames[code] || code;
  }
}
