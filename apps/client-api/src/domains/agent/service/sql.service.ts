import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { normalizeBigInt, safeStringify } from '@app/shared/utils/json.util';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SqlService {
  private readonly logger = new Logger(SqlService.name);

  constructor(
    private prisma: PrismaRepository,
    private geminiService: GeminiService,
  ) {}

  /**
   * Generate and execute SQL with retry on failure
   * If query fails, analyze error and regenerate query (max 3 attempts)
   */
  async generateAndExecuteSQLWithRetry(
    naturalQuery: string,
    maxRetries: number = 3,
  ): Promise<{
    answer: string;
    sql: string;
    rowCount: number;
    rawData: any[];
    retries?: number;
  }> {
    const schema = await this.getDatabaseSchema();
    let lastError: Error | null = null;
    let errorContext = '';
    let sqlResult: { sql: string; isValid: boolean } | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this.logger.log(
          `🔧 Generate SQL (attempt ${attempt + 1}/${maxRetries}) cho: ${naturalQuery}`,
        );

        // Generate SQL with error context from previous attempt
        sqlResult = await this.generateSQL(naturalQuery, schema, errorContext);
        this.logger.log(`📝 Generated SQL: ${sqlResult.sql}`);

        if (!sqlResult.isValid) {
          throw new Error('SQL validation failed: contains forbidden keywords');
        }

        // Execute query
        this.logger.log(`🗄️ Executing SQL...`);
        const data = await this.prisma.$queryRawUnsafe<any[]>(sqlResult.sql);
        const dataParsed = normalizeBigInt(data);

        // Format response
        const answer = await this.formatSQLResponse(
          naturalQuery,
          dataParsed,
          sqlResult.sql,
        );

        this.logger.log(
          `✅ SQL executed successfully on attempt ${attempt + 1}`,
        );

        return {
          answer,
          sql: sqlResult.sql,
          rowCount: dataParsed.length,
          rawData: dataParsed,
          retries: attempt,
        };
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `⚠️ SQL execution failed (attempt ${attempt + 1}/${maxRetries}): ${error.message}`,
        );

        // Build error context for next attempt (include failed SQL)
        const failedSQL = sqlResult?.sql || 'unknown';
        errorContext = this.buildErrorContext(error, naturalQuery, failedSQL);

        // If this is the last attempt, throw
        if (attempt === maxRetries - 1) {
          this.logger.error(
            `❌ All ${maxRetries} SQL attempts failed for query: ${naturalQuery}`,
          );
          throw new Error(
            `Không thể tạo truy vấn hợp lệ sau ${maxRetries} lần thử. Lỗi cuối: ${error.message}`,
          );
        }

        // Wait a bit before retry
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Should never reach here, but just in case
    throw lastError || new Error('Unknown SQL error');
  }

  /**
   * Legacy method without retry (kept for backward compatibility)
   */
  async generateAndExecuteSQL(naturalQuery: string): Promise<{
    answer: string;
    sql: string;
    rowCount: number;
    rawData: any[];
  }> {
    this.logger.log(`🔧 Generate SQL cho: ${naturalQuery}`);

    const schema = await this.getDatabaseSchema(); // lấy cấu trúc DB
    const sqlResult = await this.generateSQL(naturalQuery, schema);
    this.logger.log('Check sql:', sqlResult.sql);
    // if (!sqlResult.isValid) {
    //   throw new Error(`SQL không hợp lệ cho query: ${naturalQuery}`);
    // }

    // Thực thi SELECT bằng $queryRawUnsafe (đã validate trước đó)
    this.logger.log(`🗄️ Executing SQL: ${sqlResult.sql}`);
    const data = await this.prisma.$queryRawUnsafe<any[]>(sqlResult.sql);
    const dataParsed = normalizeBigInt(data);
    const answer = await this.formatSQLResponse(
      naturalQuery,
      dataParsed,
      sqlResult.sql,
    );

    return {
      answer,
      sql: sqlResult.sql,
      rowCount: dataParsed.length,
      rawData: dataParsed,
    };
  }

  /**
   * Build error context for retry
   */
  private buildErrorContext(
    error: any,
    originalQuery: string,
    failedSQL: string,
  ): string {
    const errorMsg = error.message || String(error);

    // Parse common PostgreSQL errors
    let context = `\n\n⚠️ LẦN THỬ TRƯỚC BỊ LỖI:\n`;
    context += `Query SQL bị lỗi:\n${failedSQL}\n\n`;
    context += `Lỗi: ${errorMsg}\n`;

    if (errorMsg.includes('validation failed')) {
      context += `→ SQL chứa từ khoá nguy hiểm (DROP/DELETE/UPDATE/INSERT/ALTER TABLE/CREATE/TRUNCATE/EXEC).\n`;
      context += `→ CHỈ được dùng SELECT query. Có thể dùng subquery, CTE, window functions, date functions.\n`;
      context += `→ Kiểm tra xem có comment (--) hoặc nhiều statements (;) không.\n`;
    } else if (
      errorMsg.includes('column') &&
      errorMsg.includes('does not exist')
    ) {
      const match = errorMsg.match(/column "([^"]+)" does not exist/);
      if (match) {
        context += `→ Cột "${match[1]}" không tồn tại trong schema. Kiểm tra lại tên cột chính xác.\n`;
      }
    } else if (
      errorMsg.includes('relation') &&
      errorMsg.includes('does not exist')
    ) {
      const match = errorMsg.match(/relation "([^"]+)" does not exist/);
      if (match) {
        context += `→ Bảng "${match[1]}" không tồn tại trong schema. Kiểm tra lại tên bảng chính xác.\n`;
      }
    } else if (errorMsg.includes('syntax error')) {
      context += `→ Lỗi cú pháp SQL. Kiểm tra lại cú pháp PostgreSQL.\n`;
    } else if (errorMsg.includes('ambiguous')) {
      context += `→ Tên cột mơ hồ. Cần thêm tên bảng prefix (ví dụ: \"User\".\"id\").\n`;
    } else {
      context += `→ Lỗi không xác định. Thử cách tiếp cận khác.\n`;
    }

    context += `\nHÃY TẠO QUERY MỚI KHẮC PHỤC LỖI TRÊN.\n`;
    return context;
  }

  private async generateSQL(
    query: string,
    schema: string,
    errorContext: string = '',
  ): Promise<{
    sql: string;
    isValid: boolean;
  }> {
    const prompt = `
Bạn là chuyên gia PostgreSQL.
DƯỚI ĐÂY LÀ SCHEMA THỰC TẾ (duy nhất đúng). CHỈ ĐƯỢC DÙNG các tên bảng/cột xuất hiện trong phần SCHEMA.
Nếu thiếu cột/bảng cần thiết → trả về đúng chuỗi: SCHEMA_MISMATCH

SCHEMA:
${schema}

YÊU CẦU NGƯỜI DÙNG: "${query}"${errorContext}

QUY TẮC:
- Luôn có LIMIT hợp lý, sử dụng SELECT nâng cao của PostgreSQL (có thể dùng subquery, CTE, window functions, date functions).
- Tất cả tên bảng/cột phải đặt trong "double quotes" đúng chính tả như SCHEMA.
- Không được bịa tên bảng/cột. Không dùng alias ngoài schema.
- KHÔNG ĐƯỢC viết comment (-- hoặc /* */) trong SQL.
- Có thể dùng: subquery, WITH (CTE), window functions, date functions (NOW, INTERVAL, DATE_TRUNC), aggregate (COUNT, SUM, AVG).
- Nếu câu hỏi nói "học viên/sinh viên" → hiểu là bảng/cột tương ứng trong SCHEMA (ví dụ "User" với role='STUDENT' nếu có).
- Nếu không thể map được vì schema thiếu, trả "SCHEMA_MISMATCH".
- Nếu có lỗi từ lần thử trước, PHẢI sửa lỗi đó trong query mới.

CHỈ TRẢ VỀ SQL (hoặc SCHEMA_MISMATCH), KHÔNG GIẢI THÍCH:
`;

    const out = await this.geminiService.generateResponse(prompt);
    const sql = out
      .trim()
      .replace(/```sql|```/g, '')
      .trim();
    return { sql, isValid: this.validateSQL(sql) };
  }

  private async getDatabaseSchema(): Promise<string> {
    try {
      // Duyệt information_schema để lấy cấu trúc bảng/cột
      const rows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          t.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name, c.ordinal_position
      `);

      const grouped = rows.reduce((acc: any, r: any) => {
        acc[r.table_name] = acc[r.table_name] || [];
        acc[r.table_name].push(r);
        return acc;
      }, {});

      let s = '📊 CẤU TRÚC DATABASE:\n\n';
      for (const [table, cols] of Object.entries(grouped)) {
        s += `🏷️ Table: ${table}\n`;
        (cols as any[]).forEach((col) => {
          s += `   - ${col.column_name} (${col.data_type})\n`;
        });
        s += '\n';
      }
      return s;
    } catch (e) {
      this.logger.error('❌ Lỗi lấy schema:', e as any);
      return 'Schema unavailable';
    }
  }

  private validateSQL(sql: string): boolean {
    const upper = sql.toUpperCase();

    // Block dangerous keywords with word boundaries
    // Use regex \b to match whole words only
    const dangerousPatterns = [
      /\bDROP\s+/i,
      /\bDELETE\s+/i,
      /\bUPDATE\s+/i,
      /\bINSERT\s+/i,
      /\bALTER\s+/i,
      /\bCREATE\s+/i,
    ];

    if (dangerousPatterns.some((pattern) => pattern.test(sql))) {
      return false;
    }

    // // Allow single semicolon at end, but block multiple statements
    // const trimmedSql = sql.trim();
    // const semicolonCount = (sql.match(/;/g) || []).length;

    return true;
  }

  private async formatSQLResponse(
    query: string,
    data: any[],
    sql: string,
  ): Promise<string> {
    const preview = safeStringify(data.slice(0, 10), 2);
    const prompt = `
Người dùng hỏi: "${query}"
SQL đã thực thi: ${sql}
Dữ liệu (${data.length} bản ghi, hiển thị tối đa 10):


${preview}${data.length > 10 ? '\n... (và ' + (data.length - 10) + ' bản ghi khác)' : ''}

Hãy tóm tắt kết quả rõ ràng bằng tiếng Việt:
- Danh sách → đánh số 1., 2., 3.
- Thống kê → mô tả ngắn gọn
- Không có dữ liệu → nói rõ
- Luôn nêu số lượng kết quả
`;
    return this.geminiService.generateResponse(prompt);
  }
}
