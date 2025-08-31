// src/tools/api-search.tool.ts
import { StructuredTool } from '@langchain/core/tools';
import { Injectable, Logger, } from '@nestjs/common';
import { z } from 'zod';
import { SwaggerService } from '../../swagger/swagger.service';

@Injectable()
export class ApiSearchTool extends StructuredTool {
  name = 'api_search';
  description = 'Tìm endpoint nội bộ theo câu tự nhiên. Trả về danh sách method+path+params phù hợp nhất.';
  schema = z.object({
    query: z.string().describe('Mô tả tác vụ cần gọi API, vd: "liệt kê 10 học viên mới nhất"'),
    limit: z.number().optional().default(5),
  });

  private readonly logger = new Logger(ApiSearchTool.name);
  constructor(private swagger: SwaggerService) { super(); }

  private score(text: string, q: string) {
    const T = (s: string) => s.toLowerCase();
    const tq = T(q).split(/\s+/).filter(Boolean);
    const tt = T(text);
    let s = 0;
    for (const w of tq) if (tt.includes(w)) s += 1;
    return s;
  }

  async _call({ query, limit }: z.infer<typeof this.schema>): Promise<string> {
    const ops = this.swagger.listAllOperations();
    if (!ops.length) {
      return JSON.stringify({ success: false, error: 'Chưa có OpenAPI spec' });
    }

    const ranked = ops.map(op => {
      const haystack = [
        op.summary || '',
        op.path,
        (op.tags || []).join(' '),
        op.method,
        op.operationId || '',
      ].join(' | ');
      return { op, score: this.score(haystack, query) };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ op, score }) => ({
      score,
      method: op.method,
      path: op.path,
      summary: op.summary,
      tags: op.tags,
      requiredParams: op.parameters.filter(p => p.required).map(p => ({ name: p.name, in: p.in })),
      hasRequestBody: op.hasRequestBody,
      operationId: op.operationId, // chỉ để tham khảo
    }));

    return JSON.stringify({
      success: true,
      query,
      count: ranked.length,
      candidates: ranked,
    });
  }
}
