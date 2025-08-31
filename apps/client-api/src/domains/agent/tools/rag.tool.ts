import { StructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { RagService } from '../service/rag.service';

@Injectable()
export class RagTool extends StructuredTool {
  name = 'knowledge_search';
  description =
    'Tìm trong tài liệu (quy định/hướng dẫn/kiến thức). Dùng khi cần tra cứu policy/process.';

  schema = z.object({
    query: z.string().describe('Câu hỏi cần tìm trong knowledge base'),
  });

  private readonly logger = new Logger(RagTool.name);

  constructor(private ragService: RagService) {
    super();
  }

  async _call({ query }: z.infer<typeof this.schema>): Promise<string> {
    try {
      this.logger.log(`🔍 RAG Tool search: ${query}`);
      const result = await this.ragService.searchKnowledge(query);
      return JSON.stringify({
        success: true,
        answer: result.answer,
        sources: result.sources,
        documentsFound: result.sources.length,
      });
    } catch (e: any) {
      return JSON.stringify({
        success: false,
        error: `Lỗi RAG: ${e.message}`,
      });
    }
  }
}
