import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '@app/shared/ai/gemini.service';
import { PrismaRepository } from '@app/database';
import { ActivityType, DifficultyLevel } from '@prisma/client';

@Injectable()
export class LearningPathService {
  private readonly logger = new Logger(LearningPathService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly geminiService: GeminiService,
  ) {}

  /**
   * Generates a dynamic learning path for a user based on their performance.
   * @param userId The ID of the user.
   * @returns The newly created or updated learning path.
   */
  async generateDynamicLearningPath(userId: string) {
    this.logger.log(`Bắt đầu tạo lộ trình học tập động cho user: ${userId}`);

    // 1. Phân tích điểm yếu
    const performanceAnalysis = await this.analyzeUserPerformance(userId);

    if (!performanceAnalysis) {
      this.logger.warn(`Không có đủ dữ liệu để phân tích cho user: ${userId}`);
      // TODO: Handle case with insufficient data (e.g., return a default path)
      return null;
    }

    // 2. Tổng hợp kết quả
    const summary = this.summarizePerformance(performanceAnalysis);
    this.logger.debug(`Bản tóm tắt hiệu suất: ${summary}`);

    // 3. Gọi Gemini để tạo lộ trình
    const geminiPrompt = this.createGeminiPrompt(summary);
    const geminiResponse = await this.geminiService.generateResponse(geminiPrompt);
    this.logger.debug(`Phản hồi từ Gemini: ${geminiResponse}`);

    // 4. Lưu kết quả
    try {
      const learningPathJson = JSON.parse(geminiResponse.replace(/```json\n?|\n?```/g, ''));
      const savedPath = await this.saveLearningPath(userId, learningPathJson);
      this.logger.log(`Đã lưu lộ trình học tập thành công cho user: ${userId}`);
      return savedPath;
    } catch (error) {
      this.logger.error(`Lỗi parsing JSON hoặc lưu lộ trình học tập: ${error}`);
      throw new Error('Không thể tạo lộ trình học tập từ phản hồi của AI.');
    }
  }

  private async analyzeUserPerformance(userId: string) {
    const recentProgress = await this.prisma.progress.findMany({
      where: {
        userId,
        score: { not: null },
      },
      include: {
        activity: {
          select: {
            type: true,
            difficulty: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 50, // Lấy 50 hoạt động gần nhất
    });

    if (recentProgress.length < 5) {
      return null; // Không đủ dữ liệu
    }

    // TODO: Implement more sophisticated analysis logic
    // For now, we'll focus on activity types with low scores.
    const performanceByActivityType = new Map<ActivityType, { scores: number[]; count: number }>();

    for (const progress of recentProgress) {
      const type = progress.activity.type;
      if (!performanceByActivityType.has(type)) {
        performanceByActivityType.set(type, { scores: [], count: 0 });
      }
      const data = performanceByActivityType.get(type)!;
      data.scores.push(progress.score!);
      data.count++;
    }

    const analysisResult = {
        weaknesses: [] as { type: ActivityType; avgScore: number }[],
        strengths: [] as { type: ActivityType; avgScore: number }[],
    };

    performanceByActivityType.forEach((data, type) => {
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.count;
        if (avgScore < 70) {
            analysisResult.weaknesses.push({ type, avgScore });
        } else {
            analysisResult.strengths.push({ type, avgScore });
        }
    });

    return analysisResult;
  }

  private summarizePerformance(analysis: any): string {
    let summary = "Dưới đây là tóm tắt hiệu suất học tập của học sinh:\n";

    if (analysis.strengths.length > 0) {
        summary += "Điểm mạnh: \n";
        analysis.strengths.forEach((s: any) => {
            summary += `- ${s.type}: điểm trung bình ${s.avgScore.toFixed(0)}/100\n`;
        });
    }

    if (analysis.weaknesses.length > 0) {
        summary += "Điểm yếu cần cải thiện: \n";
        analysis.weaknesses.forEach((w: any) => {
            summary += `- ${w.type}: điểm trung bình ${w.avgScore.toFixed(0)}/100\n`;
        });
    }

    return summary;
  }

  private createGeminiPrompt(summary: string): string {
    return `
      Vai trò: "Bạn là một chuyên gia giáo dục, một người huấn luyện học tập (learning coach) giàu kinh nghiệm. Nhiệm vụ của bạn là tạo ra một lộ trình học tiếng Anh được cá nhân hóa và hiệu quả."

      Dữ liệu đầu vào:
      "${summary}"

      Yêu cầu đầu ra: "Dựa vào phân tích trên, hãy tạo một lộ trình học tập chi tiết gồm 5 bước. Trả về một đối tượng JSON duy nhất (chỉ JSON, không có giải thích hay markdown). JSON object phải chứa một key là 'learningSteps' với value là một mảng (array) các 'bước học tập'. Mỗi bước trong mảng là một object có 2 thuộc tính:
      1. 'title': một chuỗi (string) mô tả ngắn gọn, hấp dẫn về bước học tập đó (ví dụ: 'Luyện nghe qua các đoạn hội thoại ngắn').
      2. 'focusArea': một chuỗi (string) chỉ rõ kỹ năng cần tập trung, phải là một trong các giá trị của enum ActivityType (ví dụ: 'listening', 'grammar', 'speaking').

      Ví dụ cấu trúc JSON đầu ra:
      {
        "learningSteps": [
          {
            "title": "Củng cố ngữ pháp về thì hiện tại đơn",
            "focusArea": "grammar"
          },
          {
            "title": "Luyện nghe và nhận biết từ vựng trong bối cảnh du lịch",
            "focusArea": "listening"
          }
        ]
      }
      `;
  }

  private async saveLearningPath(userId: string, pathData: { learningSteps: { title: string, focusArea: string }[] }) {
    const { learningSteps } = pathData;

    if (!learningSteps || !Array.isArray(learningSteps)) {
        throw new Error("Định dạng JSON từ AI không hợp lệ, thiếu 'learningSteps'.");
    }

    const learningPath = await this.prisma.learningPath.upsert({
        where: { userId },
        update: {
            name: 'Lộ trình học tập cá nhân hóa',
            focusAreas: learningSteps.map(step => step.focusArea),
            customContent: { steps: learningSteps },
            currentStep: 0,
            isCompleted: false,
        },
        create: {
            userId,
            name: 'Lộ trình học tập cá nhân hóa',
            targetLevel: DifficultyLevel.intermediate, // Default, có thể cải thiện sau
            focusAreas: learningSteps.map(step => step.focusArea),
            customContent: { steps: learningSteps },
        },
    });

    return learningPath;
  }
}