import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Translate } from '@google-cloud/translate/build/src/v2';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';
import { join } from 'path';
import { UploadService } from '../upload/upload.service';
import { VietnameseUtil } from './vietnamese.util';

@Injectable()
export class GoogleTranslateService {
  private readonly translateClient: Translate;
  private readonly ttsClient: TextToSpeechClient;

  constructor(private readonly configService: ConfigService) {
    // Khởi tạo Google Translate client
    this.translateClient = new Translate({
      projectId: this.configService.getOrThrow<string>(
        'GOOGLE_CLOUD_PROJECT_ID',
      ),
      keyFilename: this.configService.getOrThrow<string>(
        'GOOGLE_CLOUD_KEY_FILE',
      ),
    });

    // Khởi tạo Text-to-Speech client
    this.ttsClient = new TextToSpeechClient({
      projectId: this.configService.getOrThrow<string>(
        'GOOGLE_CLOUD_PROJECT_ID',
      ),
      keyFilename: this.configService.getOrThrow<string>(
        'GOOGLE_CLOUD_KEY_FILE',
      ),
    });
  }

  /**
   * Dịch văn bản từ ngôn ngữ nguồn sang ngôn ngữ đích
   */
  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
  ) {
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
  async textToSpeech(
    text: string,
    languageCode: string = 'en-US',
    voiceName?: string,
  ) {
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
  async translateAndGenerateAudio(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
  ) {
    try {
      // Bước 1: Dịch văn bản
      const translation = await this.translateText(
        text,
        targetLanguage,
        sourceLanguage,
      );

      // Bước 2: Tạo audio cho bản dịch
      const audio = await this.textToSpeech(
        translation.translatedText,
        targetLanguage,
      );

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
      return languages.map((lang) => ({
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

      return (
        result.voices?.map((voice) => ({
          name: voice.name,
          languageCodes: voice.languageCodes,
          ssmlGender: voice.ssmlGender,
          naturalSampleRateHertz: voice.naturalSampleRateHertz,
        })) || []
      );
    } catch (error) {
      console.error('Get available voices error:', error);
      throw new Error('Failed to get available voices');
    }
  }
}

@Injectable()
export class GoogleTranslateFreeService {
  private readonly logger = new Logger(GoogleTranslateFreeService.name);
  private readonly vietnameseUtil = new VietnameseUtil();

  constructor(private readonly uploadService?: UploadService) {}

  /**
   * Tạo audio từ văn bản sử dụng Google Translate TTS miễn phí
   */
  async createAudioFile(
    text: string,
    language: string = 'en',
  ): Promise<string> {
    // Google Translate TTS rejects very long `q` parameters. Split text into safe chunks
    // (try to keep each chunk under ~200 characters) and fetch each segment, appending
    // the resulting MP3 bytes into a single file.
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
    const safeText = text
      .substring(0, 50)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
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
          this.logger.error(
            `TTS request failed for chunk ${i} status=${response.status} body=${bodyText}`,
          );
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
  async createAudioWithUrl(
    text: string,
    language: string = 'en',
  ): Promise<{ filePath: string; url: string }> {
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
  async createAudioForMultipleLanguages(
    text: string,
    languages: string[] = ['en', 'vi', 'es'],
  ): Promise<{ [key: string]: string }> {
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

    return supportedLanguages.includes(language);
  }

  // ============== VIETNAMESE-SPECIFIC FEATURES ==============

  /**
   * Tạo audio tiếng Việt với tùy chọn phương ngữ miền
   */
  async createVietnameseAudioWithRegionalAccent(
    text: string,
    region: 'north' | 'central' | 'south' = 'north',
  ): Promise<{ filePath: string; url: string; region: string }> {
    // Tiền xử lý văn bản tiếng Việt để tối ưu phát âm theo vùng miền
    const preprocessedText = this.preprocessVietnameseForRegionalAccent(
      text,
      region,
    );

    const result = await this.createAudioWithUrl(preprocessedText, 'vi');

    return {
      ...result,
      region,
    };
  }

  /**
   * Phân tích và cải thiện văn bản tiếng Việt để học phát âm
   */
  async analyzeVietnameseForPronunciation(text: string): Promise<{
    originalText: string;
    phoneticGuide: Array<{ word: string; pronunciation: any }>;
    tonalAnalysis: string;
    difficulty: any;
    suggestions: string[];
    audioUrl: string;
  }> {
    const words = this.vietnameseUtil.improvedVietnameseTokenize(text);
    const phoneticGuide = words.map((word) => ({
      word,
      pronunciation: this.vietnameseUtil.generatePronunciationGuide(word),
    }));

    const difficulty = this.vietnameseUtil.assessReadingLevel(text);
    const tonalAnalysis = this.analyzeTonalPattern(text);

    const suggestions = this.generatePronunciationSuggestions(text, difficulty);

    // Tạo audio hướng dẫn
    const { url: audioUrl } = await this.createAudioWithUrl(text, 'vi');

    return {
      originalText: text,
      phoneticGuide,
      tonalAnalysis,
      difficulty,
      suggestions,
      audioUrl,
    };
  }

  /**
   * Tạo bài tập điền từ tiếng Việt từ văn bản
   */
  async generateVietnameseFillBlankExercise(text: string): Promise<{
    exercise: string;
    answers: Array<{ blank: number; word: string; options: string[] }>;
    difficulty: string;
    audioUrl: string;
  }> {
    const vocabulary = this.vietnameseUtil.extractKeyVocabulary(text);
    const difficulty = this.vietnameseUtil.assessReadingLevel(text);

    // Chọn từ để tạo chỗ trống (ưu tiên từ không phổ biến)
    const wordsToBlank = vocabulary
      .filter((item) => !item.isCommon && item.word.length > 2)
      .slice(0, 5); // Tối đa 5 từ

    let exercise = text;
    const answers: Array<{ blank: number; word: string; options: string[] }> =
      [];

    wordsToBlank.forEach((item, index) => {
      const blankNumber = index + 1;
      exercise = exercise.replace(
        new RegExp(`\\b${item.word}\\b`, 'gi'),
        `___${blankNumber}___`,
      );

      // Tạo các lựa chọn nhiễu
      const options = this.generateDistractorOptions(item.word);

      answers.push({
        blank: blankNumber,
        word: item.word,
        options: [item.word, ...options].sort(() => Math.random() - 0.5),
      });
    });

    // Tạo audio cho bài tập
    const { url: audioUrl } = await this.createAudioWithUrl(text, 'vi');

    return {
      exercise,
      answers,
      difficulty: difficulty.level,
      audioUrl,
    };
  }

  /**
   * Tạo câu hỏi trắc nghiệm về ngữ pháp tiếng Việt
   */
  async generateVietnameseGrammarQuiz(text: string): Promise<{
    questions: Array<{
      question: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
    }>;
    difficulty: string;
  }> {
    const formalityLevel = this.vietnameseUtil.detectFormalityLevel(text);
    const difficulty = this.vietnameseUtil.assessReadingLevel(text);

    const questions = [];

    // Câu hỏi về mức độ trang trọng
    questions.push({
      question: `Văn bản này thuộc mức độ trang trọng nào?`,
      options: ['Trang trọng', 'Thân mật', 'Trung tính', 'Không xác định'],
      correctAnswer:
        formalityLevel === 'formal'
          ? 'Trang trọng'
          : formalityLevel === 'informal'
            ? 'Thân mật'
            : 'Trung tính',
      explanation: `Dựa vào các từ ngữ và cách diễn đạt trong văn bản, mức độ trang trọng được xác định là ${formalityLevel}.`,
    });

    // Thêm câu hỏi về từ loại, cấu trúc câu...
    const vocabulary = this.vietnameseUtil.extractKeyVocabulary(text);
    if (vocabulary.length > 0) {
      const keyWord = vocabulary[0];
      questions.push({
        question: `Từ "${keyWord.word}" trong văn bản có nghĩa gì?`,
        options: [
          keyWord.definition || 'Nghĩa chính',
          'Nghĩa sai 1',
          'Nghĩa sai 2',
          'Nghĩa sai 3',
        ],
        correctAnswer: keyWord.definition || 'Nghĩa chính',
        explanation: `Từ "${keyWord.word}" có nghĩa là: ${keyWord.definition || 'nghĩa chính trong ngữ cảnh này'}.`,
      });
    }

    return {
      questions,
      difficulty: difficulty.level,
    };
  }

  /**
   * Tạo audio học từ vựng tiếng Việt với tốc độ chậm
   */
  async createVietnameseVocabularyAudio(
    words: string[],
    options: {
      speed: 'slow' | 'normal' | 'fast';
      includeDefinitions?: boolean;
    } = { speed: 'normal' },
  ): Promise<{
    audioUrl: string;
    vocabulary: Array<{
      word: string;
      definition?: string;
      pronunciation: any;
    }>;
  }> {
    const vocabulary = words.map((word) => ({
      word,
      definition: this.vietnameseUtil.extractKeyVocabulary(word)[0]?.definition,
      pronunciation: this.vietnameseUtil.generatePronunciationGuide(word),
    }));

    // Tạo script cho audio
    let script = '';
    words.forEach((word, index) => {
      script += `Từ số ${index + 1}: ${word}. `;
      if (options.includeDefinitions) {
        const definition = vocabulary[index].definition;
        if (definition) {
          script += `Nghĩa là: ${definition}. `;
        }
      }
      script += `Lặp lại: ${word}. ${word}. `;

      // Thêm khoảng dừng cho tốc độ chậm
      if (options.speed === 'slow') {
        script += '... ... ... ';
      }
    });

    const { url: audioUrl } = await this.createAudioWithUrl(script, 'vi');

    return {
      audioUrl,
      vocabulary,
    };
  }

  /**
   * Tạo bài tập nghe-viết tiếng Việt
   */
  async createVietnameseListeningExercise(text: string): Promise<{
    audioUrl: string;
    exercise: {
      instruction: string;
      questions: Array<{
        type: 'multiple-choice' | 'fill-blank' | 'true-false';
        question: string;
        options?: string[];
        correctAnswer: string;
      }>;
    };
    difficulty: string;
  }> {
    const difficulty = this.vietnameseUtil.assessReadingLevel(text);
    const sentences =
      this.vietnameseUtil.detectVietnameseSentenceBoundaries(text);

    // Tạo audio
    const { url: audioUrl } = await this.createAudioWithUrl(text, 'vi');

    // Tạo câu hỏi nghe
    const questions = [];

    // Câu hỏi trắc nghiệm về nội dung chính
    questions.push({
      type: 'multiple-choice' as const,
      question: 'Chủ đề chính của đoạn văn này là gì?',
      options: ['Chủ đề A', 'Chủ đề B', 'Chủ đề C', 'Chủ đề D'],
      correctAnswer: 'Chủ đề A',
    });

    // Câu hỏi điền từ dựa vào nghe
    if (sentences.length > 0) {
      const vocabulary = this.vietnameseUtil.extractKeyVocabulary(sentences[0]);
      if (vocabulary.length > 0) {
        const wordToBlank = vocabulary[0].word;
        const questionSentence = sentences[0].replace(
          new RegExp(`\\b${wordToBlank}\\b`, 'gi'),
          '____',
        );

        questions.push({
          type: 'fill-blank' as const,
          question: `Điền từ còn thiếu: "${questionSentence}"`,
          correctAnswer: wordToBlank,
        });
      }
    }

    return {
      audioUrl,
      exercise: {
        instruction: 'Nghe đoạn văn và trả lời các câu hỏi sau:',
        questions,
      },
      difficulty: difficulty.level,
    };
  }

  // ============== PRIVATE HELPER METHODS ==============

  private preprocessVietnameseForRegionalAccent(
    text: string,
    region: 'north' | 'central' | 'south',
  ): string {
    let processedText = text;

    // Xử lý khác biệt phương ngữ
    switch (region) {
      case 'south':
        // Miền Nam: d -> gi, tr -> ch
        processedText = processedText.replace(/\bd/g, 'gi');
        break;
      case 'central':
        // Miền Trung: giữ nguyên đặc điểm riêng
        break;
      case 'north':
      default:
        // Miền Bắc: chuẩn
        break;
    }

    return processedText;
  }

  private analyzeTonalPattern(text: string): string {
    const words = this.vietnameseUtil.improvedVietnameseTokenize(text);
    const toneCount = {
      ngang: 0,
      huyền: 0,
      sắc: 0,
      hỏi: 0,
      ngã: 0,
      nặng: 0,
    };

    words.forEach((word) => {
      if (/[àằầèềìòồờùừỳ]/.test(word)) toneCount.huyền++;
      else if (/[áắấéếíóốớúứý]/.test(word)) toneCount.sắc++;
      else if (/[ảẳẩẻểỉỏổởủửỷ]/.test(word)) toneCount.hỏi++;
      else if (/[ãẵẫẽễĩõỗỡũữỹ]/.test(word)) toneCount.ngã++;
      else if (/[ạặậẹệịọộợụựỵ]/.test(word)) toneCount.nặng++;
      else toneCount.ngang++;
    });

    const dominantTone = Object.entries(toneCount).sort(
      ([, a], [, b]) => b - a,
    )[0][0];

    return `Thanh điệu chiếm ưu thế: ${dominantTone}. Phân bố: ${JSON.stringify(toneCount)}`;
  }

  private generatePronunciationSuggestions(
    text: string,
    difficulty: any,
  ): string[] {
    const suggestions = [];

    if (difficulty.level === 'beginner') {
      suggestions.push('Đọc từng từ một cách chậm rãi');
      suggestions.push('Chú ý thanh điệu của từng từ');
    } else if (difficulty.level === 'intermediate') {
      suggestions.push('Luyện tập đọc theo nhóm từ');
      suggestions.push('Chú ý ngữ điệu câu');
    } else {
      suggestions.push('Tập trung vào cảm xúc và ý nghĩa');
      suggestions.push('Luyện tập đọc diễn cảm');
    }

    if (/[áắấéếíóốớúứý]/.test(text)) {
      suggestions.push('Chú ý các từ có thanh sắc - giọng lên rõ');
    }
    if (/[àằầèềìòồờùừỳ]/.test(text)) {
      suggestions.push('Chú ý các từ có thanh huyền - giọng xuống');
    }

    return suggestions;
  }

  private generateDistractorOptions(targetWord: string): string[] {
    // Tạo các lựa chọn nhiễu cho bài tập điền từ
    const options = [];

    // Từ có vần giống
    const rhymeOptions = this.findRhymingWords(targetWord);
    options.push(...rhymeOptions.slice(0, 2));

    // Từ có nghĩa liên quan
    const semanticOptions = this.findSemanticallySimilarWords(targetWord);
    options.push(...semanticOptions.slice(0, 1));

    // Từ có hình thức tương tự
    const morphologicalOptions =
      this.findMorphologicallySimilarWords(targetWord);
    options.push(...morphologicalOptions.slice(0, 2));

    return options.slice(0, 3); // Tối đa 3 lựa chọn nhiễu
  }

  private findRhymingWords(word: string): string[] {
    // Đơn giản hóa: tìm từ có âm cuối giống
    const rhymes: Record<string, string[]> = {
      ăn: ['an', 'ban', 'can'],
      học: ['hoc', 'doc', 'loc'],
      nói: ['toi', 'loi', 'roi'],
      đi: ['di', 'ti', 'li'],
    };
    return rhymes[word] || [];
  }

  private findSemanticallySimilarWords(word: string): string[] {
    // Từ đồng nghĩa hoặc cùng lĩnh vực
    const semantic: Record<string, string[]> = {
      học: ['tập', 'đọc', 'nghiên cứu'],
      nói: ['kể', 'bảo', 'phát biểu'],
      đi: ['bước', 'chạy', 'di chuyển'],
    };
    return semantic[word] || [];
  }

  private findMorphologicallySimilarWords(word: string): string[] {
    // Từ có dạng thức tương tự
    if (word.length <= 2) return [];

    const similar = [];
    // Thay đổi 1 ký tự
    for (let i = 0; i < word.length; i++) {
      const chars = ['a', 'e', 'i', 'o', 'u', 'n', 'm', 'ng'];
      chars.forEach((char) => {
        if (char !== word[i]) {
          const newWord = word.substring(0, i) + char + word.substring(i + 1);
          if (newWord !== word) similar.push(newWord);
        }
      });
    }

    return similar.slice(0, 3);
  }
}
