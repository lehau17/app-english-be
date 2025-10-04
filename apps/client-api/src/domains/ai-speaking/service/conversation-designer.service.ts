import { Injectable } from '@nestjs/common';
import { DifficultyLevel } from '@prisma/client';

interface BuildOpeningPromptOptions {
  topic?: string;
  difficulty: DifficultyLevel;
}

interface OpeningPromptPlan {
  prompt: string;
  followUpSuggestions: string[];
  metadata: Record<string, unknown>;
  version: string;
}

const DIFFICULTY_HINT: Record<DifficultyLevel, string> = {
  beginner:
    'Hãy dùng từ vựng đơn giản, nói chậm rãi và khuyến khích học viên trả lời bằng câu ngắn.',
  elementary:
    'Khuyến khích học viên mở rộng câu trả lời với 1-2 câu, tập trung thì hiện tại đơn giản.',
  intermediate:
    'Tạo thử thách với câu hỏi “Why/How” và gợi ý sử dụng liên từ cơ bản.',
  upper_intermediate:
    'Đào sâu nội dung với câu hỏi “What if/Compare”, khuyến khích ví dụ cá nhân.',
  advanced:
    'Tạo thảo luận đa chiều, yêu cầu lập luận và phân tích ưu/nhược điểm.',
  expert:
    'Đặt câu hỏi phức tạp, hướng tới phản biện sâu và sử dụng thuật ngữ chuyên ngành.',
};

@Injectable()
export class ConversationDesignerService {
  buildOpeningPrompt(options: BuildOpeningPromptOptions): OpeningPromptPlan {
    const topic = options.topic ?? 'your daily life';
    const hint =
      DIFFICULTY_HINT[options.difficulty] ?? DIFFICULTY_HINT.beginner;

    const prompt = `Hello! Let's practice speaking about "${topic}". Could you share some initial thoughts about this topic?`;

    return {
      prompt,
      followUpSuggestions: [
        `What do you find most interesting about ${topic}?`,
        'Can you share a short example from your experience?',
        'How does this topic affect your daily routine?',
      ],
      metadata: {
        topic,
        difficulty: options.difficulty,
        hint,
      },
      version: '1.0.0',
    };
  }
}
