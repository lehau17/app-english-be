import { StructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { SqlService } from '../service/sql.service';

@Injectable()
export class SqlTool extends StructuredTool {
  name = 'database_query';
  description =
    'Truy vấn dữ liệu thực tế từ database. Dùng cho thống kê/ranking/danh sách.';

  schema = z.object({
    naturalQuery: z.string().describe('Câu hỏi về dữ liệu cần truy vấn DB'),
  });

  private readonly logger = new Logger(SqlTool.name);

  constructor(private sqlService: SqlService) {
    super();
  }

  async _call({ naturalQuery }: z.infer<typeof this.schema>): Promise<string> {
    try {
      this.logger.log(`🗄️ SQL Tool xử lý: ${naturalQuery}`);
      // Use retry-enabled method
      const result = await this.sqlService.generateAndExecuteSQLWithRetry(naturalQuery);
      return JSON.stringify({
        success: true,
        answer: result.answer,
        sql: result.sql,
        rowCount: result.rowCount,
        data: result.rawData.slice(0, 5),
        retries: result.retries || 0,
      });
    } catch (e: any) {
      this.logger.error(`❌ SQL Tool error after retries: ${e.message}`);
      return JSON.stringify({
        success: false,
        error: `Không thể truy vấn dữ liệu. Vui lòng thử diễn đạt câu hỏi khác hoặc liên hệ admin.`,
        details: e.message,
      });
    }
  }
}
