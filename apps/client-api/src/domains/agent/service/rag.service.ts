// RAG Service dùng Prisma thay vì TypeORM
// - Lưu/tìm tài liệu từ bảng knowledge_documents
// - Tính cosine similarity trong RAM (embedding lưu dạng JSON string)
// - Phase sau có thể chuyển sang pgvector + truy vấn ANN bằng raw SQL

import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from './gemini.service';

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

    try {
      // Validate input
      if (
        !addDocumentDto.content ||
        addDocumentDto.content.trim().length === 0
      ) {
        throw new Error('Document content cannot be empty');
      }

      const embedding = await this.geminiService.generateEmbedding(
        addDocumentDto.content,
      );

      if (!embedding || embedding.length === 0) {
        throw new Error('Failed to generate embedding for document');
      }

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
        // Use parameterized query for security
        await this.prisma.$executeRawUnsafe(
          `UPDATE knowledge_document SET embedding_vector = $1::vector WHERE id = $2`,
          vectorText,
          doc.id,
        );
        this.logger.log(`✅ Successfully saved pgvector for doc ${doc.id}`);
      } catch (e) {
        this.logger.warn(
          `Không thể lưu embedding_vector (pgvector) cho doc ${doc.id}: ${(e as any)?.message}`,
        );
        // Don't fail the entire operation if pgvector fails
      }

      this.logger.log(`✅ Đã lưu tài liệu ID: ${doc.id}`);
      return doc;
    } catch (error) {
      this.logger.error(
        `❌ Failed to add document: ${addDocumentDto.title}`,
        error,
      );
      throw error;
    }
  }

  async searchKnowledge(query: string): Promise<{
    answer: string;
    sources: any[];
    confidence: number;
  }> {
    // Validate input
    if (!query || query.trim().length === 0) {
      return {
        answer: 'Vui lòng cung cấp câu hỏi để tìm kiếm.',
        sources: [],
        confidence: 0,
      };
    }

    this.logger.log(`🔍 Tìm kiếm knowledge cho: ${query}`);

    try {
      const qEmbed = await this.geminiService.generateEmbedding(query);

      if (!qEmbed || qEmbed.length === 0) {
        this.logger.error('Failed to generate embedding for query');
        return {
          answer: 'Không thể xử lý câu hỏi của bạn. Vui lòng thử lại.',
          sources: [],
          confidence: 0,
        };
      }

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
    } catch (error) {
      this.logger.error('Error during knowledge search', error);
      return {
        answer: 'Đã xảy ra lỗi khi tìm kiếm thông tin. Vui lòng thử lại sau.',
        sources: [],
        confidence: 0,
      };
    }
  }

  private async findSimilarDocuments(queryEmbedding: number[], topK = 3) {
    // Validate input embedding
    if (!queryEmbedding || queryEmbedding.length === 0) {
      this.logger.warn('Invalid query embedding provided');
      return [];
    }

    // Nếu cột embedding_vector đã có dữ liệu, dùng truy vấn ANN của Postgres (pgvector)
    try {
      const vectorText = `[${queryEmbedding.join(',')}]`;
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, title, content, document_type, source, embedding
         FROM knowledge_document
         WHERE embedding_vector IS NOT NULL
         ORDER BY embedding_vector <-> $1::vector
         LIMIT $2`,
        vectorText,
        Number(topK),
      );

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
          `Found ${normalized.length} documents using pgvector ANN`,
        );
        return normalized;
      }
    } catch (e) {
      // Log the specific error for debugging
      this.logger.warn(
        `ANN query failed: ${(e as any)?.message}, falling back to in-memory similarity`,
      );
    }

    // Fallback: nếu có lỗi hoặc không có pgvector, dùng cách cũ
    try {
      const allDocs = await this.prisma.knowledgeDocument.findMany();
      if (allDocs.length === 0) {
        this.logger.warn('No documents found in knowledge base');
        return [];
      }

      const scored = allDocs
        .map((d) => {
          try {
            const emb = d.embedding
              ? (JSON.parse(d.embedding) as number[])
              : [];
            if (emb.length === 0) {
              return null; // Skip documents without embeddings
            }
            return { doc: d, sim: this.cosineSimilarity(queryEmbedding, emb) };
          } catch (parseError) {
            this.logger.warn(
              `Failed to parse embedding for doc ${d.id}: ${parseError}`,
            );
            return null;
          }
        })
        .filter((x) => x !== null && x.sim > 0.6) // Filter out invalid results and low similarity
        .sort((a, b) => b.sim - a.sim);

      const result = scored.slice(0, topK).map((x) => x.doc);

      this.logger.log(
        `Found ${result.length} documents using in-memory similarity (${scored.length} candidates)`,
      );
      return result;
    } catch (fallbackError) {
      this.logger.error('Fallback similarity search failed', fallbackError);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]) {
    // Handle edge cases
    if (!a || !b || a.length === 0 || b.length === 0) {
      return 0;
    }

    // Ensure both vectors have the same length
    const minLength = Math.min(a.length, b.length);
    if (minLength === 0) return 0;

    let dot = 0;
    let magA = 0;
    let magB = 0;

    // Calculate dot product and magnitudes in one pass
    for (let i = 0; i < minLength; i++) {
      const aVal = a[i] || 0;
      const bVal = b[i] || 0;
      dot += aVal * bVal;
      magA += aVal * aVal;
      magB += bVal * bVal;
    }

    // Handle zero magnitude vectors
    const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
    if (magnitude === 0) return 0;

    return dot / magnitude;
  }

  private calculateConfidence(docs: any[]) {
    if (!docs || docs.length === 0) {
      return 0;
    }

    // Base confidence starts from document count
    let confidence = Math.min(docs.length * 0.2, 0.8);

    // Add bonus for having multiple sources
    const uniqueSources = new Set(docs.map((d) => d.source)).size;
    if (uniqueSources > 1) {
      confidence += 0.1;
    }

    // Add bonus for document type variety
    const uniqueTypes = new Set(docs.map((d) => d.documentType)).size;
    if (uniqueTypes > 1) {
      confidence += 0.1;
    }

    // Ensure confidence stays within bounds
    confidence = Math.max(0.1, Math.min(confidence, 1.0));

    return Math.round(confidence * 100) / 100;
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
