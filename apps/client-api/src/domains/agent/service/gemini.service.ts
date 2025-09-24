import { GoogleGenerativeAI } from '@google/generative-ai';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
        // khuyến nghị mới: 'text-embedding-004' (768 chiều)
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
        // gợi ý: 'gemini-2.5-flash' để nhanh, hoặc 'gemini-2.5-pro' nếu cần
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

  async generateAttemptFeedback(
    attemptData: {
      score: number;
      maxScore: number;
      activityType?: string;
      userAnswers?: any;
      correctAnswers?: any;
      timeSpent?: number;
    },
  ): Promise<string> {
    try {
      const { score, maxScore, activityType, userAnswers, correctAnswers, timeSpent } = attemptData;

      // Nếu đạt điểm tối đa thì không cần đánh giá
      if (score === maxScore) {
        return 'Hoàn hảo! Bạn đã đạt điểm tối đa. Tiếp tục phát huy!';
      }

      const scorePercentage = Math.round((score / maxScore) * 100);

      let prompt = `Bạn là một giáo viên tiếng Anh chuyên nghiệp. Hãy phân tích và đưa ra nhận xét chi tiết, mang tính xây dựng cho bài làm của học sinh.

Thông tin bài làm:
- Điểm số: ${score}/${maxScore} (${scorePercentage}%)
- Loại hoạt động: ${activityType || 'Bài tập'}
- Thời gian làm bài: ${timeSpent ? `${Math.round(timeSpent / 60)} phút` : 'Không có thông tin'}

`;

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

Nhận xét:`;

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });

      const result = await model.generateContent(prompt);
      const feedback = result.response.text().trim();

      this.logger.log(`✅ Đã tạo nhận xét AI cho attempt: ${score}/${maxScore}`);
      return feedback;

    } catch (error) {
      this.logger.error('Lỗi tạo nhận xét AI cho attempt:', error);
      // Fallback nhận xét cơ bản
      const scorePercentage = Math.round((attemptData.score / attemptData.maxScore) * 100);
      return `Bạn đã hoàn thành bài làm với ${scorePercentage}% độ chính xác. Hãy tiếp tục luyện tập để cải thiện kết quả!`;
    }
  }

  // Nếu dùng LangChain adapter thì tuỳ file agent implement
}
