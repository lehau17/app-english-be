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

  // Nếu dùng LangChain adapter thì tuỳ file agent implement
}
