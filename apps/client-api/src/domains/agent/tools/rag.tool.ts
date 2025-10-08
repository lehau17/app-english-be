import { StructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { RagService } from '../service/rag.service';

@Injectable()
export class RagTool extends StructuredTool {
  name = 'knowledge_search';
  description = `📚 KNOWLEDGE BASE SEARCH TOOL - Semantic + keyword search in documents (NOT for structure/counts).

⚠️ USE THIS TOOL (not graph_query) when user asks about:
1. CONTENT: "là gì", "what is", "giải thích", "explain"
2. RULES/POLICIES: "quy định", "quy chế", "điều kiện", "yêu cầu"
3. DEFINITIONS: "nghĩa của từ", "definition", "meaning"
4. PROCEDURES: "cách làm", "how to", "hướng dẫn"
5. EXAMPLES: "ví dụ về", "examples of"

✅ Good examples (USE knowledge_search):
- "Quy chế tốt nghiệp là gì?" → CONTENT
- "Giải thích ngữ pháp present simple" → DEFINITION
- "Cách đăng ký khóa học" → PROCEDURE
- "Ví dụ về conditional sentences" → EXAMPLES

❌ Bad examples (use graph_query instead):
- "Khóa học có bao nhiêu bài?" → STRUCTURAL (use graph_query)
- "Tìm khóa liên quan" → RELATIONSHIP (use graph_query)
- "Lộ trình học" → PATH (use graph_query)`;


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
