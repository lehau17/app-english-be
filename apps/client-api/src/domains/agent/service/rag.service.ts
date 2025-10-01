// RAG Service dùng Prisma thay vì TypeORM
// - Lưu/tìm tài liệu từ bảng knowledge_documents
// - Tính cosine similarity trong RAM (embedding lưu dạng JSON string)
// - Phase sau có thể chuyển sang pgvector + truy vấn ANN bằng raw SQL

import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '@app/shared';

// DTO bạn đã có trong dto/query.dto (AddDocumentDto)
type AddDocumentDto = {
  title: string;
  content: string;
  documentType: string;
  source: string;
};

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private prisma: PrismaRepository,
    private geminiService: GeminiService,
  ) {
    // Tự seed tài liệu mẫu
    this.loadSampleDocuments();
  }

  async addDocument(addDocumentDto: AddDocumentDto) {
    this.logger.log(`📄 Đang thêm tài liệu: ${addDocumentDto.title}`);
    const embedding = await this.geminiService.generateEmbedding(
      addDocumentDto.content,
    );
    // Lưu cả bản JSON (backward compat) và cột vector (pgvector) để ANN query
    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        ...addDocumentDto,
        embedding: JSON.stringify(embedding),
      },
    });

    // Ghi vector vào cột embedding_vector (kiểu pgvector) bằng raw SQL cast
    try {
      const vectorText = `[${embedding.join(',')}]`;
      // ✅ Safe: Use $executeRaw with proper parameterization
      await this.prisma.$executeRaw`
        UPDATE knowledge_documents
        SET embedding_vector = ${vectorText}::vector
        WHERE id = ${doc.id}
      `;
    } catch (e) {
      this.logger.warn(
        `Không thể lưu embedding_vector (pgvector) cho doc ${doc.id}: ${(e as any)?.message}`,
      );
    }
    this.logger.log(`✅ Đã lưu tài liệu ID: ${doc.id}`);
    return doc;
  }

  async searchKnowledge(query: string): Promise<{
    answer: string;
    sources: any[];
    confidence: number;
  }> {
    this.logger.log(`🔍 Tìm kiếm knowledge cho: ${query}`);
    const qEmbed = await this.geminiService.generateEmbedding(query);

    const relevantDocs = await this.findSimilarDocuments(qEmbed, 3);
    if (relevantDocs.length === 0) {
      return {
        answer:
          'Tôi không tìm thấy thông tin liên quan trong tài liệu knowledge base.',
        sources: [],
        confidence: 0,
      };
    }

    const context = relevantDocs
      .map((d) => `📋 ${d.title} (${d.documentType}):\n${d.content}`)
      .join('\n\n');

    const prompt = `
Dựa trên các tài liệu sau đây, hãy trả lời câu hỏi một cách chính xác và chi tiết:

TÀI LIỆU THAM KHẢO:
${context}

CÂU HỎI: ${query}

YÊU CẦU:
- Chỉ trả lời dựa trên thông tin có trong tài liệu
- Trích dẫn cụ thể các điều khoản, số liệu khi có thể
- Nếu thông tin không đầy đủ, hãy nói rõ điều đó
- Trả lời bằng tiếng Việt, dễ hiểu
`;

    const answer = await this.geminiService.generateResponse(prompt);

    return {
      answer,
      sources: relevantDocs.map((d) => ({
        id: d.id,
        title: d.title,
        type: d.documentType,
        source: d.source,
      })),
      confidence: this.calculateConfidence(relevantDocs),
    };
  }

  private async findSimilarDocuments(queryEmbedding: number[], topK = 3) {
    // Nếu cột embedding_vector đã có dữ liệu, dùng truy vấn ANN của Postgres (pgvector)
    try {
      // ✅ Safe: Use parameterized query with Prisma's $queryRaw
      const vectorText = `[${queryEmbedding.join(',')}]`;

      // Use $queryRaw with template literal for type safety
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT id, title, content, document_type, source, embedding
        FROM knowledge_documents
        WHERE embedding_vector IS NOT NULL
        ORDER BY embedding_vector <-> ${vectorText}::vector
        LIMIT ${topK}
      `;

      // Normalize column names so caller gets { id, title, documentType, content, source }
      const normalized = (rows || []).map((r: any) => ({
        id: r.id,
        title: r.title || r.name || r.heading,
        documentType: r.document_type || r.documentType,
        content: r.content,
        source: r.source,
        embedding: r.embedding,
      }));

      if (normalized.length > 0) {
        this.logger.log(
          `✅ Found ${normalized.length} documents using pgvector ANN query`,
        );
        return normalized;
      }
    } catch (e) {
      // Fallback: nếu có lỗi (ví dụ pgvector chưa có), dùng cách cũ
      this.logger.warn(
        'ANN query failed, falling back to in-memory similarity: ' +
          (e as any)?.message,
      );
    }

    // Fallback to in-memory similarity calculation
    this.logger.log('Using fallback in-memory similarity search');
    const allDocs = await this.prisma.knowledgeDocument.findMany();
    const scored = allDocs.map((d) => {
      const emb = d.embedding ? (JSON.parse(d.embedding) as number[]) : [];
      return { doc: d, sim: this.cosineSimilarity(queryEmbedding, emb) };
    });

    return scored
      .filter((x) => x.sim > 0.6)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, topK)
      .map((x) => ({
        id: x.doc.id,
        title: x.doc.title,
        documentType: x.doc.documentType,
        content: x.doc.content,
        source: x.doc.source,
        embedding: x.doc.embedding,
      }));
  }

  private cosineSimilarity(a: number[], b: number[]) {
    const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
    const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return dot / (magA * magB || 1);
  }

  private calculateConfidence(docs: any[]) {
    const base = Math.min(docs.length * 0.25, 1);
    return Math.round(base * 100) / 100;
  }

  // Seed 3 tài liệu mẫu nếu DB đang trống
  private async loadSampleDocuments() {
    const count = await this.prisma.knowledgeDocument.count();
    if (count > 0) {
      this.logger.log(`📚 Knowledge base đã có ${count} tài liệu`);
      return;
    }

    const samples: Array<Omit<AddDocumentDto, 'embedding'>> = [
      {
        title: 'Quy chế đào tạo - Điều kiện tốt nghiệp',
        content: `
ĐIỀU 15: ĐIỀU KIỆN TỐT NGHIỆP ĐẠI HỌC
1) Hoàn thành đủ số tín chỉ (≥120)
2) GPA ≥ 5.0/10.0
3) Không môn nào < 4.0/10.0
4) Hoàn thành khoá luận hoặc thi tốt nghiệp
5) Đạt chuẩn ngoại ngữ/tin học
        `,
        documentType: 'regulation',
        source: 'Thông tư 08/2021/TT-BGDĐT',
      },
      {
        title: 'Quy chế đào tạo - Xếp loại tốt nghiệp',
        content: `
ĐIỀU 16: XẾP LOẠI
- Xuất sắc: GPA ≥ 8.5; không môn < 7.0; đúng tiến độ
- Giỏi:     7.0 ≤ GPA < 8.5; không môn < 5.0
- Khá:      6.0 ≤ GPA < 7.0; không môn < 4.0
- Trung bình: 5.0 ≤ GPA < 6.0
        `,
        documentType: 'regulation',
        source: 'Thông tư 08/2021/TT-BGDĐT',
      },
      {
        title: 'Hướng dẫn tính điểm GPA',
        content: `
GPA = Σ(Điểm × Số tín chỉ) / Σ(Tổng tín chỉ)
Ví dụ: (8.5×3 + 7.0×2 + 9.0×2) / 7 = 8.21
        `,
        documentType: 'handbook',
        source: 'Phòng Đào tạo',
      },
    ];

    for (const s of samples) {
      try {
        await this.addDocument(s);
        this.logger.log(`✅ Seed doc: ${s.title}`);
      } catch (e) {
        this.logger.error(`❌ Lỗi seed doc: ${s.title}`, e as any);
      }
    }
  }
}
