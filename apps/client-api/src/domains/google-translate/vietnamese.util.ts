import { Injectable } from '@nestjs/common';

/**
 * Vietnamese Language Utilities
 * Cung cấp các tiện ích xử lý văn bản tiếng Việt
 */
@Injectable()
export class VietnameseUtil {
  // Vietnamese diacritics mapping
  private readonly vietnameseDiacriticsMap = new Map([
    ['à', 'a'],
    ['á', 'a'],
    ['ả', 'a'],
    ['ã', 'a'],
    ['ạ', 'a'],
    ['ă', 'a'],
    ['ằ', 'a'],
    ['ắ', 'a'],
    ['ẳ', 'a'],
    ['ẵ', 'a'],
    ['ặ', 'a'],
    ['â', 'a'],
    ['ầ', 'a'],
    ['ấ', 'a'],
    ['ẩ', 'a'],
    ['ẫ', 'a'],
    ['ậ', 'a'],
    ['è', 'e'],
    ['é', 'e'],
    ['ẻ', 'e'],
    ['ẽ', 'e'],
    ['ẹ', 'e'],
    ['ê', 'e'],
    ['ề', 'e'],
    ['ế', 'e'],
    ['ể', 'e'],
    ['ễ', 'e'],
    ['ệ', 'e'],
    ['ì', 'i'],
    ['í', 'i'],
    ['ỉ', 'i'],
    ['ĩ', 'i'],
    ['ị', 'i'],
    ['ò', 'o'],
    ['ó', 'o'],
    ['ỏ', 'o'],
    ['õ', 'o'],
    ['ọ', 'o'],
    ['ô', 'o'],
    ['ồ', 'o'],
    ['ố', 'o'],
    ['ổ', 'o'],
    ['ỗ', 'o'],
    ['ộ', 'o'],
    ['ơ', 'o'],
    ['ờ', 'o'],
    ['ớ', 'o'],
    ['ở', 'o'],
    ['ỡ', 'o'],
    ['ợ', 'o'],
    ['ù', 'u'],
    ['ú', 'u'],
    ['ủ', 'u'],
    ['ũ', 'u'],
    ['ụ', 'u'],
    ['ư', 'u'],
    ['ừ', 'u'],
    ['ứ', 'u'],
    ['ử', 'u'],
    ['ữ', 'u'],
    ['ự', 'u'],
    ['ỳ', 'y'],
    ['ý', 'y'],
    ['ỷ', 'y'],
    ['ỹ', 'y'],
    ['ỵ', 'y'],
    ['đ', 'd'],
  ]);

  // Vietnamese tone markers
  private readonly vietnameseTones = {
    ngang: '', // không dấu
    huyền: '`', // dấu huyền
    sắc: '´', // dấu sắc
    hỏi: '?', // dấu hỏi
    ngã: '~', // dấu ngã
    nặng: '.', // dấu nặng
  };

  // Common Vietnamese words for context
  private readonly commonVietnameseWords = [
    'và',
    'của',
    'có',
    'trong',
    'không',
    'với',
    'được',
    'là',
    'một',
    'cho',
    'các',
    'này',
    'đã',
    'sẽ',
    'về',
    'hay',
    'như',
    'từ',
    'khi',
    'lại',
    'người',
    'thì',
    'ra',
    'hơn',
    'nếu',
    'rất',
    'còn',
    'sau',
    'tại',
    'vì',
  ];

  // Vietnamese formal/informal indicators
  private readonly formalIndicators = [
    'kính thưa',
    'xin chào',
    'tôi',
    'chúng tôi',
    'quý khách',
    'quý vị',
    'kính gửi',
    'trân trọng',
    'kính mến',
    'xin phép',
    'kính báo',
  ];

  private readonly informalIndicators = [
    'chào',
    'tao',
    'mày',
    'bạn',
    'mình',
    'ơi',
    'nhé',
    'đây',
    'kìa',
    'này',
    'nè',
    'ha',
    'hả',
    'vậy à',
    'thế à',
  ];

  /**
   * Loại bỏ dấu thanh điệu tiếng Việt
   */
  removeDiacritics(text: string): string {
    return text
      .toLowerCase()
      .split('')
      .map((char) => this.vietnameseDiacriticsMap.get(char) || char)
      .join('');
  }

  /**
   * Phát hiện mức độ trang trọng của văn bản tiếng Việt
   */
  detectFormalityLevel(text: string): 'formal' | 'informal' | 'neutral' {
    const lowerText = text.toLowerCase();

    const formalCount = this.formalIndicators.reduce((count, indicator) => {
      return count + (lowerText.includes(indicator) ? 1 : 0);
    }, 0);

    const informalCount = this.informalIndicators.reduce((count, indicator) => {
      return count + (lowerText.includes(indicator) ? 1 : 0);
    }, 0);

    if (formalCount > informalCount) return 'formal';
    if (informalCount > formalCount) return 'informal';
    return 'neutral';
  }

  /**
   * Tách từ tiếng Việt cải tiến (xử lý từ ghép)
   */
  improvedVietnameseTokenize(text: string): string[] {
    // Xử lý các trường hợp đặc biệt của tiếng Việt
    const preprocessed = text
      .replace(
        /([a-záàảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵđ]+)([A-ZÁÀẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬEÈÉẺẼẸÊỀẾỂỄỆIÌÍỈĨỊOÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢUÙÚỦŨỤƯỪỨỬỮỰYỲÝỶỸỴĐ])/g,
        '$1 $2',
      )
      .replace(/\s+/g, ' ')
      .trim();

    return preprocessed.split(/\s+/).filter((word) => word.length > 0);
  }

  /**
   * Phát hiện ranh giới câu tiếng Việt
   */
  detectVietnameseSentenceBoundaries(text: string): string[] {
    // Xử lý các trường hợp đặc biệt của tiếng Việt
    const sentences = text
      .split(
        /(?<=[.!?])\s+(?=[A-ZÁÀẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬEÈÉẺẼẸÊỀẾỂỄỆIÌÍỈĨỊOÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢUÙÚỦŨỤƯỪỨỬỮỰYỲÝỶỸỴĐ])/g,
      )
      .filter((sentence) => sentence.trim().length > 0);

    return sentences;
  }

  /**
   * Tạo hướng dẫn phát âm tiếng Việt
   */
  generatePronunciationGuide(word: string): {
    ipa: string;
    simplified: string;
    toneDescription: string;
  } {
    const toneDescription = this.detectTone(word);

    // Đơn giản hóa phát âm cho người học
    const simplified = this.simplifyPronunciation(word);

    // IPA cơ bản (sẽ cần mở rộng)
    const ipa = this.convertToBasicIPA(word);

    return {
      ipa,
      simplified,
      toneDescription,
    };
  }

  /**
   * Phát hiện thanh điệu
   */
  private detectTone(word: string): string {
    if (/[àằầèềìòồờùừỳ]/.test(word)) return 'Thanh huyền (giọng xuống)';
    if (/[áắấéếíóốớúứý]/.test(word)) return 'Thanh sắc (giọng lên)';
    if (/[ảẳẩẻểỉỏổởủửỷ]/.test(word)) return 'Thanh hỏi (giọng cong)';
    if (/[ãẵẫẽễĩõỗỡũữỹ]/.test(word)) return 'Thanh ngã (giọng gãy)';
    if (/[ạặậẹệịọộợụựỵ]/.test(word)) return 'Thanh nặng (giọng đứt)';
    return 'Thanh ngang (giọng bằng)';
  }

  /**
   * Đơn giản hóa phát âm
   */
  private simplifyPronunciation(word: string): string {
    return word
      .replace(/ch/g, 'c')
      .replace(/tr/g, 'ch')
      .replace(/gi/g, 'z')
      .replace(/d/g, 'z')
      .replace(/r/g, 'z')
      .replace(/s/g, 's')
      .replace(/x/g, 's')
      .replace(/ph/g, 'f')
      .replace(/th/g, 't')
      .replace(/kh/g, 'k')
      .replace(/gh/g, 'g')
      .replace(/nh/g, 'ng')
      .replace(/qu/g, 'kw');
  }

  /**
   * Chuyển đổi cơ bản sang IPA
   */
  private convertToBasicIPA(word: string): string {
    // Đây là phiên bản cơ bản, cần mở rộng để chính xác hơn
    return word
      .replace(/ch/g, 'tʃ')
      .replace(/tr/g, 'ʈ')
      .replace(/gi/g, 'z')
      .replace(/d/g, 'z')
      .replace(/r/g, 'z')
      .replace(/ph/g, 'f')
      .replace(/th/g, 't')
      .replace(/kh/g, 'x')
      .replace(/gh/g, 'ɣ')
      .replace(/nh/g, 'ɲ')
      .replace(/ng/g, 'ŋ')
      .replace(/qu/g, 'kw');
  }

  /**
   * Trích xuất từ vựng quan trọng
   */
  extractKeyVocabulary(text: string): Array<{
    word: string;
    frequency: number;
    isCommon: boolean;
    definition?: string;
  }> {
    const words = this.improvedVietnameseTokenize(text.toLowerCase());
    const wordCount = new Map<string, number>();

    words.forEach((word) => {
      if (word.length > 1) {
        // Bỏ qua từ có 1 ký tự
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      }
    });

    const vocabulary = Array.from(wordCount.entries())
      .map(([word, frequency]) => ({
        word,
        frequency,
        isCommon: this.commonVietnameseWords.includes(word),
        definition: this.getBasicDefinition(word),
      }))
      .sort((a, b) => b.frequency - a.frequency);

    return vocabulary;
  }

  /**
   * Lấy định nghĩa cơ bản (sẽ cần tích hợp với từ điển thực tế)
   */
  private getBasicDefinition(word: string): string | undefined {
    const basicDefinitions: Record<string, string> = {
      học: 'nghiên cứu, tiếp thu kiến thức',
      tập: 'luyện tập, thực hành',
      nói: 'phát ra lời, giao tiếp bằng lời',
      nghe: 'tiếp nhận âm thanh qua tai',
      đọc: 'nhận biết và hiểu chữ viết',
      viết: 'ghi chép bằng chữ',
      từ: 'đơn vị ngôn ngữ có nghĩa',
      câu: 'nhóm từ diễn đạt ý nghĩa hoàn chỉnh',
      nghĩa: 'ý nghĩa, ý tưởng được biểu đạt',
      tiếng: 'âm thanh của ngôn ngữ',
    };

    return basicDefinitions[word];
  }

  /**
   * Đánh giá mức độ khó của văn bản tiếng Việt
   */
  assessReadingLevel(text: string): {
    level: 'beginner' | 'intermediate' | 'advanced';
    score: number;
    factors: {
      avgWordLength: number;
      avgSentenceLength: number;
      vocabularyComplexity: number;
      commonWordRatio: number;
    };
  } {
    const sentences = this.detectVietnameseSentenceBoundaries(text);
    const words = this.improvedVietnameseTokenize(text);

    const avgWordLength =
      words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const avgSentenceLength = words.length / sentences.length;

    const commonWords = words.filter((word) =>
      this.commonVietnameseWords.includes(word.toLowerCase()),
    );
    const commonWordRatio = commonWords.length / words.length;

    const vocabularyComplexity = 1 - commonWordRatio;

    // Tính điểm tổng thể (0-100)
    let score = 0;
    score += Math.min(avgWordLength * 10, 30); // Độ dài từ (tối đa 30 điểm)
    score += Math.min(avgSentenceLength * 2, 30); // Độ dài câu (tối đa 30 điểm)
    score += vocabularyComplexity * 40; // Độ phức tạp từ vựng (tối đa 40 điểm)

    let level: 'beginner' | 'intermediate' | 'advanced';
    if (score < 30) level = 'beginner';
    else if (score < 60) level = 'intermediate';
    else level = 'advanced';

    return {
      level,
      score,
      factors: {
        avgWordLength,
        avgSentenceLength,
        vocabularyComplexity,
        commonWordRatio,
      },
    };
  }
}
