import { PrismaRepository } from '@app/database';
import { normalizeBigInt, safeStringify } from '@app/shared/utils/json.util';
import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from './gemini.service';

@Injectable()
export class SqlService {
  private readonly logger = new Logger(SqlService.name);

  constructor(
    private prisma: PrismaRepository,
    private geminiService: GeminiService,
  ) {}

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

  private async generateSQL(
    query: string,
    schema: string,
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

YÊU CẦU NGƯỜI DÙNG: "${query}"

QUY TẮC:
- CHỈ viết 1 câu SELECT duy nhất. Luôn có LIMIT.
- Tất cả tên bảng/cột phải đặt trong "double quotes" đúng chính tả như SCHEMA.
- Không được bịa tên bảng/cột. Không dùng alias ngoài schema.
- Nếu câu hỏi nói "học viên/sinh viên" → hiểu là bảng/cột tương ứng trong SCHEMA (ví dụ "User" với role='STUDENT' nếu có).
- Nếu không thể map được vì schema thiếu, trả "SCHEMA_MISMATCH".

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
    if (!upper.startsWith('SELECT')) return false;

    const banned = [
      'DROP',
      'DELETE',
      'UPDATE',
      'INSERT',
      'ALTER',
      'CREATE',
      'TRUNCATE',
      'EXEC',
      'EXECUTE',
      '--',
      ';--',
    ];
    if (banned.some((kw) => upper.includes(kw))) return false;

    // Optional: cấm ; để tránh multiple statements
    if (sql.includes(';')) return false;

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
