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
  categories?: EvaluationCategory[];
  detail?: Record<string, any> | null;
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
    this.logger.log('✅ Gemini service khởi tạo thành công');
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
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
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
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 10000,
        },
      });

      const result = await model.generateContent(prompt);
      console.log('Raw Gemini feedback response:', result);
      const feedback = result.response.text().trim();
      console.log('Processed Gemini feedback:', feedback);

      this.logger.log(
        `✅ Đã tạo nhận xét AI cho attempt: ${score}/${maxScore}`,
      );
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
    const prompt = `Bạn là giáo viên tiếng Anh. Học sinh vừa đọc câu: "${targetPhrase}".

QUAN TRỌNG: Trước khi chấm điểm, hãy kiểm tra kỹ:
1. Nếu bạn KHÔNG nghe thấy bất kỳ giọng nói nào (chỉ có im lặng, tiếng ồn nền, hoặc không có âm thanh)
2. Nếu file quá ngắn (<0.5 giây)
3. Nếu transcript rỗng hoặc không có từ nào được nhận diện

→ Hãy trả về:
{
  "score": 0,
  "feedback": "Không nhận được ghi âm hợp lệ. Bạn chưa nói gì hoặc ghi âm quá ngắn. Vui lòng nói rõ ràng và ghi âm lại.",
  "transcript": "",
  "categories": [],
  "detail": { "mispronounced": [] }
}

Nếu CÓ giọng nói rõ ràng, hãy chấm phát âm và trả về JSON với cấu trúc:
{
  "score": number (0-100),
  "feedback": string (bằng tiếng Việt, khuyến khích và chỉ rõ âm cần sửa),
  "transcript": string (phải có nội dung, không được rỗng),
  "categories": [
    { "name": "Accuracy", "comment": "..." },
    { "name": "Stress", "comment": "..." },
    { "name": "Intonation", "comment": "..." }
  ],
  "detail": {
    "mispronounced": ["word", ...]
  }
}

Lưu ý: transcript PHẢI có nội dung nếu có giọng nói. Nếu transcript rỗng thì coi như không có giọng nói.`;

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
    const prompt = `Bạn là giáo viên tiếng Anh. Học sinh thực hành nói với yêu cầu: "${
      taskPrompt ?? 'Nói tự do'
    }".
Nếu bạn không nghe thấy lời nói rõ ràng (file chỉ có tĩnh lặng/ồn nền hoặc quá ngắn < ${Math.max(
      minSeconds ?? 0,
      5,
    )} giây), hãy đặt score = 0 và feedback = "Không nhận được ghi âm hợp lệ".
Hãy:
1. Phiên âm hoặc ghi lại phần nói của học sinh.
2. Đánh giá độ lưu loát, phát âm, từ vựng, ngữ pháp.
3. Chấm điểm tổng thể (0-100), trong đó 70 là qua.
4. Trả về JSON với cấu trúc:
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
    "duration": ${minSeconds ?? 0},
    "suggestedPhrases": ["..."]
  }
}
Giữ phản hồi bằng tiếng Việt, thân thiện, đưa gợi ý cải thiện.`;

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
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 10000,
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

      return {
        score,
        feedback: parsed.feedback || 'Chưa có nhận xét.',
        categories: parsed.categories,
        transcript: parsed.transcript,
        detail: parsed.detail,
      };
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
