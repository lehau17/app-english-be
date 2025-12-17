import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jsonrepair } from 'jsonrepair';

type EvaluationCategory = {
  name: string;
  comment: string;
};

type EvaluationPayload = {
  score: number;
  feedback: string;
  transcript?: string;
  contentMatch?: 'none' | 'partial' | 'full';
  categories?: EvaluationCategory[];
  detail?: {
    mispronounced?: string[];
    missingWords?: string[];
    extraWords?: string[];
    [key: string]: any;
  } | null;
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY chưa được cấu hình trong .env');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.logger.log('Gemini service khởi tạo thành công');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embeddingModel = this.genAI.getGenerativeModel({
        model: 'text-embedding-004',
      });
      const result: any = await embeddingModel.embedContent(text);
      return result?.embedding?.values || [];
    } catch (error) {
      this.logger.error('Lỗi tạo embedding:', error);
      throw new BadRequestException(
        'Không thể tạo embedding cho văn bản đã cho.',
      );
    }
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
        generationConfig: { temperature: 0.7, maxOutputTokens: 10000 },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      this.logger.error('Lỗi sinh response:', error);
      throw new BadRequestException(
        'Không thể sinh response cho prompt đã cho.',
      );
    }
  }

  /**
   * Generate JSON response from Gemini (forces JSON output)
   */
  async generateJSONResponse(prompt: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 10000,
          responseMimeType: 'application/json',
        },
      });
      const result = await model.generateContent(prompt, {});
      console.log('check result gemoni', result);
      const value = result.response.text();
      console.log('Check valie', value);
      return value;
    } catch (error) {
      this.logger.error('Lỗi sinh JSON response:', error);
      throw new BadRequestException(
        'Không thể sinh JSON response cho prompt đã cho.',
      );
    }
  }

  async generateAttemptFeedback(attemptData: {
    score: number;
    maxScore: number;
    activityType?: string;
    userAnswers?: any;
    correctAnswers?: any;
    timeSpent?: number;
    assignmentTitle?: string;
    assignmentDescription?: string;
    activities?: any[];
    maxWords?: number;
  }): Promise<string> {
    try {
      const {
        score,
        maxScore,
        activityType,
        userAnswers,
        correctAnswers,
        timeSpent,
        assignmentTitle,
        assignmentDescription,
        activities,
        maxWords = 200,
      } = attemptData;

      if (score === maxScore) {
        return 'Hoàn hảo! Bạn đã đạt điểm tối đa. Tiếp tục phát huy!';
      }

      const scorePercentage = Math.round((score / maxScore) * 100);

      let prompt = `Bạn là một giáo viên tiếng Anh chuyên nghiệp. Hãy phân tích và đưa ra nhận xét chi tiết, mang tính xây dựng cho bài làm của học sinh.

Thông tin bài tập:
${assignmentTitle ? `- Tên bài tập: ${assignmentTitle}` : ''}
${assignmentDescription ? `- Mô tả: ${assignmentDescription}` : ''}
- Điểm số: ${score}/${maxScore} (${scorePercentage}%)
- Loại hoạt động: ${activityType || 'Bài tập'}
- Thời gian làm bài: ${timeSpent ? `${Math.round(timeSpent / 60)} phút` : 'Không có thông tin'}

`;

      if (activities && activities.length > 0) {
        prompt += `Các hoạt động trong bài tập:\n`;
        activities.forEach((activity, index) => {
          prompt += `${index + 1}. ${activity.title || activity.type} (${activity.points || 10} điểm)\n`;
        });
        prompt += `\n`;
      }

      if (userAnswers && correctAnswers) {
        prompt += `Câu trả lời của học sinh: ${JSON.stringify(userAnswers)}\n`;
        prompt += `Đáp án đúng: ${JSON.stringify(correctAnswers)}\n`;
      }

      prompt += `
Yêu cầu:
1. Phân tích điểm mạnh và điểm cần cải thiện
2. Đưa ra lời khuyên cụ thể để học sinh tiến bộ
3. Khuyến khích và động viên học sinh
4. Giữ giọng điệu thân thiện, tích cực và chuyên nghiệp
5. Viết bằng tiếng Việt
6. Giới hạn feedback trong ${maxWords} từ, cô đọng và súc tích

Nhận xét:`;

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 10000,
        },
      });

      const result = await model.generateContent(prompt);
      console.log('Raw Gemini feedback response:', result);
      const feedback = result.response.text().trim();
      console.log('Processed Gemini feedback:', feedback);

      this.logger.log(`Đã tạo nhận xét AI cho attempt: ${score}/${maxScore}`);
      return feedback;
    } catch (error) {
      this.logger.error('Lỗi tạo nhận xét AI cho attempt:', error);
      const scorePercentage = Math.round(
        (attemptData.score / attemptData.maxScore) * 100,
      );
      return `Bạn đã hoàn thành bài làm với ${scorePercentage}% độ chính xác. Hãy tiếp tục luyện tập để cải thiện kết quả!`;
    }
  }

  async evaluatePronunciation(params: {
    audioBase64: string;
    mimeType?: string;
    targetPhrase: string;
  }): Promise<EvaluationPayload> {
    const { audioBase64, mimeType, targetPhrase } = params;
    const prompt = `Bạn là giáo viên tiếng Anh chuyên nghiệp. Học sinh vừa được yêu cầu đọc câu: "${targetPhrase}".

BƯỚC 1 - KIỂM TRA KỸ THUẬT (QUAN TRỌNG):
1. Nếu KHÔNG nghe thấy giọng nói nào (im lặng, tiếng ồn, hoặc file lỗi)
2. Nếu file âm thanh quá ngắn (<0.5 giây)
3. Nếu không nhận diện được từ nào (transcript rỗng)

→ Trả về:
{
  "score": 0,
  "feedback": "Không nhận được ghi âm hợp lệ. Bạn chưa nói gì hoặc ghi âm quá ngắn. Vui lòng nói rõ ràng và ghi âm lại.",
  "transcript": "",
  "contentMatch": "none",
  "categories": [],
  "detail": { "mispronounced": [] }
}

BƯỚC 2 - KIỂM TRA NỘI DUNG (BẮT BUỘC):
Nếu CÓ giọng nói rõ ràng, hãy so sánh nội dung học sinh nói với câu mục tiêu:

A. Nếu học sinh nói HOÀN TOÀN SAI NỘI DUNG:
   → contentMatch: "none"
   → score: 0-20
   → feedback: "Bạn đã nói sai nội dung. Câu mục tiêu là: '${targetPhrase}', nhưng bạn nói: '[transcript]'. Vui lòng đọc lại đúng câu."

B. Nếu học sinh nói THIẾU hoặc THÊM một số từ:
   → contentMatch: "partial"
   → score: 30-60
   → feedback: Chỉ rõ từ nào bị thiếu hoặc thêm

C. Nếu học sinh nói ĐÚNG NỘI DUNG:
   → contentMatch: "full"
   → score: 60-100
   → feedback: Chấm điểm pronunciation, stress, intonation bình thường

OUTPUT FORMAT (BẮT BUỘC):
{
  "score": number (0-100),
  "feedback": string (tiếng Việt),
  "transcript": string (PHẢI có nội dung nếu có giọng nói),
  "contentMatch": "none" | "partial" | "full",
  "categories": [
    { "name": "Accuracy", "comment": "..." },
    { "name": "Stress", "comment": "..." },
    { "name": "Intonation", "comment": "..." }
  ],
  "detail": {
    "mispronounced": ["word1", "word2"],
    "missingWords": ["word3"],
    "extraWords": ["word4"]
  }
}

LƯU Ý: Nội dung sai → điểm thấp (0-20), bất kể phát âm tốt. Nội dung đúng → chấm pronunciation.`;

    return this.generateEvaluation(
      [
        {
          inlineData: { mimeType: mimeType || 'audio/webm', data: audioBase64 },
        },
        { text: prompt },
      ],
      { schemaName: 'pronunciationEvaluation' },
    );
  }

  async evaluateSpeaking(params: {
    audioBase64: string;
    mimeType?: string;
    prompt?: string;
    minSeconds?: number;
  }): Promise<EvaluationPayload> {
    const { audioBase64, mimeType, prompt: taskPrompt, minSeconds } = params;
    const prompt = `Bạn là giáo viên tiếng Anh chuyên nghiệp. Học sinh thực hành nói với yêu cầu: "${
      taskPrompt ?? 'Nói tự do'
    }".

HƯỚNG DẪN ĐÁNH GIÁ THÔNG MINH:

BƯỚC 1 - KIỂM TRA CHẤT LƯỢNG AUDIO:
- Nếu HOÀN TOÀN KHÔNG có giọng nói (chỉ có im lặng hoặc tiếng ồn): score = 0
- Nếu có giọng nói nhưng KHÔNG nghe rõ được từ nào: score = 10-20
- Nếu có giọng nói và nghe được một số từ: tiếp tục đánh giá bình thường

BƯỚC 2 - ĐÁNH GIÁ NỘI DUNG (nếu có giọng nói):
Dù audio ngắn hay dài, hãy đánh giá dựa trên CHẤT LƯỢNG thực tế:
- Audio ngắn (1-3 giây) nhưng nói rõ ràng, đúng chủ đề: vẫn có thể đạt 50-70 điểm
- Audio dài nhưng nói lắp bắp, sai nhiều: điểm thấp hơn
- Thời lượng chỉ là 1 yếu tố, không phải yếu tố quyết định

TIÊU CHÍ CHẤM ĐIỂM (0-100):
1. Fluency (Độ lưu loát): Nói trôi chảy, ít ngắc ngứ
2. Pronunciation (Phát âm): Phát âm rõ ràng, đúng trọng âm
3. Vocabulary (Từ vựng): Sử dụng từ phù hợp, đa dạng
4. Grammar (Ngữ pháp): Cấu trúc câu chính xác
5. Relevance (Liên quan): Nội dung đúng chủ đề yêu cầu

THANG ĐIỂM THAM KHẢO:
- 0-20: Không có nội dung hoặc hoàn toàn không liên quan
- 21-40: Cố gắng nói nhưng nhiều lỗi, khó hiểu
- 41-60: Nói được ý cơ bản, có một số lỗi
- 61-80: Nói tốt, ít lỗi, dễ hiểu
- 81-100: Xuất sắc, tự nhiên như người bản xứ

Hãy:
1. Phiên âm chính xác phần nói của học sinh (transcript)
2. Đánh giá từng tiêu chí cụ thể
3. Đưa ra điểm công bằng dựa trên chất lượng thực tế
4. Gợi ý cách cải thiện cụ thể

Trả về JSON với cấu trúc:
{
  "score": number,
  "feedback": string,
  "transcript": string,
  "categories": [
    { "name": "Fluency", "comment": "..." },
    { "name": "Pronunciation", "comment": "..." },
    { "name": "Vocabulary", "comment": "..." },
    { "name": "Grammar", "comment": "..." }
  ],
  "detail": {
    "estimatedDuration": "short/medium/long",
    "audioQuality": "clear/moderate/unclear",
    "suggestedPhrases": ["..."],
    "improvementTips": ["..."]
  }
}

LƯU Ý QUAN TRỌNG: Đừng reject audio chỉ vì ngắn. Nếu học sinh nói được 1-2 câu rõ ràng trong 2-3 giây, hãy chấm điểm công bằng. Chỉ cho 0 điểm khi THỰC SỰ không có nội dung gì.
Giữ phản hồi bằng tiếng Việt, thân thiện, khuyến khích học sinh.`;

    return this.generateEvaluation(
      [
        {
          inlineData: { mimeType: mimeType || 'audio/webm', data: audioBase64 },
        },
        { text: prompt },
      ],
      { schemaName: 'speakingEvaluation' },
    );
  }

  async evaluateWriting(params: {
    submission: string;
    prompt?: string;
    minWords?: number;
  }): Promise<EvaluationPayload> {
    const { submission, prompt: taskPrompt, minWords } = params;
    const prompt = `Bạn là giáo viên tiếng Anh.

Đề bài: "${taskPrompt ?? 'Viết đoạn văn'}".
Yêu cầu tối thiểu: ${minWords ?? 0} từ.

Đây là bài làm của học sinh:
"""
${submission}
"""

Đánh giá và chấm điểm (0-100), trong đó 70 là qua, dựa trên nội dung, ngữ pháp, từ vựng, cấu trúc, độ liên kết.
Trả về JSON với cấu trúc:
{
  "score": number,
  "feedback": string,
  "categories": [
    { "name": "Content", "comment": "..." },
    { "name": "Vocabulary", "comment": "..." },
    { "name": "Grammar", "comment": "..." },
    { "name": "Organization", "comment": "..." }
  ],
  "detail": {
    "wordCount": ${submission.trim().split(/\s+/).filter(Boolean).length},
    "strengths": ["..."],
    "improvements": ["..."]
  }
}
Giữ phản hồi bằng tiếng Việt, cụ thể và tích cực.`;

    return this.generateEvaluation([{ text: prompt }], {
      schemaName: 'writingEvaluation',
    });
  }

  private async generateEvaluation(
    parts: Part[],
    options: { schemaName: string },
  ): Promise<EvaluationPayload> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(parts);
      console.log('Raw Gemini response:', result, result.response.candidates);

      // Check if response has candidates and get the text
      let raw = '';
      if (result.response.candidates && result.response.candidates.length > 0) {
        const candidate = result.response.candidates[0];
        if (
          candidate.content &&
          candidate.content.parts &&
          candidate.content.parts.length > 0
        ) {
          raw = candidate.content.parts[0].text || '';
        }
      }

      // Fallback to text() method if available
      if (!raw) {
        try {
          raw = result.response.text();
        } catch (e) {
          console.warn('Failed to get text from response.text():', e);
        }
      }

      console.log('Gemini raw response text:', raw);
      const parsed = this.safeParseEvaluation(raw);

      const score = Number.isFinite(parsed.score)
        ? Math.max(0, Math.min(Math.round(parsed.score), 100))
        : 0;

      const payload: EvaluationPayload = {
        score,
        feedback: parsed.feedback || 'Chưa có nhận xét.',
        categories: parsed.categories,
        transcript: parsed.transcript,
        contentMatch: parsed.contentMatch,
        detail: parsed.detail,
      };

      // Validate contentMatch consistency for pronunciation evaluation
      if (options.schemaName === 'pronunciationEvaluation') {
        payload.contentMatch = this.validateContentMatch(
          payload.contentMatch,
          payload.score,
        );
      }

      return payload;
    } catch (error) {
      this.logger.error(
        `Lỗi chấm điểm với Gemini (${options.schemaName}):`,
        error as any,
      );
      return {
        score: 60,
        feedback:
          'Không chấm được tự động. Vui lòng thử lại hoặc nhờ giáo viên đánh giá.',
        categories: undefined,
        transcript: undefined,
        detail: { fallback: true },
      };
    }
  }

  private validateContentMatch(
    contentMatch: 'none' | 'partial' | 'full' | undefined,
    score: number,
  ): 'none' | 'partial' | 'full' | undefined {
    // Validate contentMatch exists and is valid
    if (contentMatch && !['none', 'partial', 'full'].includes(contentMatch)) {
      this.logger.warn(
        `Invalid contentMatch value: ${contentMatch}, defaulting to 'partial'`,
      );
      return 'partial';
    }

    // If contentMatch is 'none' but score is high, log warning and adjust
    if (contentMatch === 'none' && score > 20) {
      this.logger.warn(
        `Inconsistent Gemini response: contentMatch='none' but score=${score}. Adjusting score to match contentMatch.`,
      );
      // Note: We don't modify score here as it's already set in the parent function
      // This validation serves as a monitoring mechanism
    }

    // If contentMatch is 'full' but score is very low, log warning
    if (contentMatch === 'full' && score < 60) {
      this.logger.warn(
        `Inconsistent Gemini response: contentMatch='full' but score=${score}. Expected score >= 60.`,
      );
    }

    return contentMatch;
  }

  private safeParseEvaluation(jsonText: string): EvaluationPayload {
    console.log('Parsing JSON:', jsonText);
    const attempts: Array<string | null | undefined> = [jsonText];

    const trimmed = jsonText.trim();
    if (trimmed !== jsonText) {
      attempts.push(trimmed);
    }

    const sliced = this.extractJsonSubstring(jsonText);
    if (sliced && !attempts.includes(sliced)) {
      attempts.push(sliced);
    }

    for (const candidate of attempts) {
      if (!candidate) continue;
      const parsed = this.tryParseCandidate(candidate);
      if (parsed) {
        return parsed;
      }
    }

    this.logger.warn(
      'Không thể parse JSON phản hồi từ Gemini. Trả về mặc định.',
      {
        raw: jsonText.substring(0, 500),
        length: jsonText.length,
        isEmpty: !jsonText || jsonText.trim().length === 0,
      },
    );

    return {
      score: 0,
      feedback: 'Không thể phân tích kết quả.',
      categories: undefined,
      transcript: undefined,
      detail: { raw: jsonText },
    };
  }

  private tryParseCandidate(text: string): EvaluationPayload | null {
    const variants = [text];
    try {
      const repaired = jsonrepair(text);
      if (repaired && repaired !== text) {
        variants.push(repaired);
      }
    } catch {
      // ignore repair errors
    }

    for (const variant of variants) {
      if (!variant) continue;
      try {
        const raw = JSON.parse(variant);
        return this.normalizeEvaluationPayload(raw);
      } catch {
        continue;
      }
    }

    return null;
  }

  private normalizeEvaluationPayload(raw: any): EvaluationPayload {
    const scoreValue = Number(raw?.score);
    const feedbackText =
      typeof raw?.feedback === 'string' && raw.feedback.trim().length > 0
        ? raw.feedback.trim()
        : 'Không có nhận xét.';

    const contentMatch =
      raw?.contentMatch &&
      ['none', 'partial', 'full'].includes(raw.contentMatch)
        ? raw.contentMatch
        : undefined;

    return {
      score: Number.isFinite(scoreValue) ? scoreValue : 0,
      feedback: feedbackText,
      categories: Array.isArray(raw?.categories)
        ? raw.categories.map((item: any) => ({
            name: String(item?.name ?? ''),
            comment: String(item?.comment ?? ''),
          }))
        : undefined,
      transcript:
        typeof raw?.transcript === 'string' && raw.transcript.trim().length > 0
          ? raw.transcript.trim()
          : undefined,
      contentMatch,
      detail: raw?.detail ?? null,
    };
  }

  private extractJsonSubstring(rawText: string): string | null {
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    return rawText.substring(firstBrace, lastBrace + 1);
  }
}
