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
    // Tự seed tài liệu mẫu - don't block constructor
    // Use setTimeout to avoid blocking and handle errors gracefully
    setTimeout(() => {
      this.loadSampleDocuments().catch((e) => {
        this.logger.error('Failed to load sample documents:', e);
      });
    }, 0);
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
      // Validate embedding is an array of numbers
      if (
        !Array.isArray(embedding) ||
        embedding.some((v) => typeof v !== 'number')
      ) {
        throw new Error('Invalid embedding format: must be array of numbers');
      }

      const vectorText = `[${embedding.join(',')}]`;
      // Use $executeRawUnsafe but with sanitized input (numbers only)
      // This is safe because we validated embedding contains only numbers
      await this.prisma.$executeRawUnsafe(
        `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
        vectorText,
        doc.id,
      );
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

    // Search across both knowledge documents and indexed model data
    const relevantDocs = await this.findSimilarDocuments(qEmbed, 5);
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
    // Validate input
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      this.logger.warn('Invalid query embedding provided');
      return [];
    }
    if (queryEmbedding.some((v) => typeof v !== 'number' || !isFinite(v))) {
      this.logger.warn('Query embedding contains invalid values');
      return [];
    }

    // Nếu cột embedding_vector đã có dữ liệu, dùng truy vấn ANN của Postgres (pgvector)
    try {
      // Safe: Use parameterized query with $queryRawUnsafe
      const vectorText = `[${queryEmbedding.join(',')}]`;

      // Use $queryRawUnsafe with proper parameterization
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, title, content, document_type, source, embedding
         FROM knowledge_documents
         WHERE embedding_vector IS NOT NULL
         ORDER BY embedding_vector <-> $1::vector
         LIMIT $2`,
        vectorText,
        topK,
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

  /**
   * Index all courses into knowledge base
   * Converts course data into searchable documents
   */
  async indexCourses(): Promise<{ indexed: number; errors: number }> {
    this.logger.log('📚 Bắt đầu index courses...');
    let indexed = 0;
    let errors = 0;

    try {
      const courses = await this.prisma.course.findMany({
        include: {
          instructor: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      });

      for (const course of courses) {
        try {
          const content = this.formatCourseContent(course);
          const docId = `course_${course.id}`;

          // Check if already indexed
          const existing = await this.prisma.knowledgeDocument.findFirst({
            where: { source: docId },
          });

          if (existing) {
            // Update existing document
            const embedding =
              await this.geminiService.generateEmbedding(content);
            await this.prisma.knowledgeDocument.update({
              where: { id: existing.id },
              data: {
                title: course.title,
                content,
                embedding: JSON.stringify(embedding),
              },
            });

            // Update pgvector column
            try {
              if (
                Array.isArray(embedding) &&
                embedding.every((v) => typeof v === 'number')
              ) {
                const vectorText = `[${embedding.join(',')}]`;
                await this.prisma.$executeRawUnsafe(
                  `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
                  vectorText,
                  existing.id,
                );
              }
            } catch (e) {
              this.logger.warn(
                `Không thể update embedding_vector cho course ${course.id}`,
              );
            }
          } else {
            // Create new document
            await this.addDocument({
              title: course.title,
              content,
              documentType: 'course',
              source: docId,
            });
          }

          indexed++;
        } catch (e) {
          this.logger.error(
            `❌ Lỗi index course ${course.id}: ${(e as any)?.message}`,
          );
          errors++;
        }
      }

      this.logger.log(`✅ Indexed ${indexed} courses, ${errors} errors`);
      return { indexed, errors };
    } catch (e) {
      this.logger.error('❌ Lỗi index courses:', e as any);
      throw e;
    }
  }

  /**
   * Index all lessons into knowledge base
   */
  async indexLessons(): Promise<{ indexed: number; errors: number }> {
    this.logger.log('📖 Bắt đầu index lessons...');
    let indexed = 0;
    let errors = 0;

    try {
      const lessons = await this.prisma.lesson.findMany({
        include: {
          course: {
            select: {
              title: true,
            },
          },
        },
      });

      for (const lesson of lessons) {
        try {
          const content = this.formatLessonContent(lesson);
          const docId = `lesson_${lesson.id}`;

          const existing = await this.prisma.knowledgeDocument.findFirst({
            where: { source: docId },
          });

          if (existing) {
            const embedding =
              await this.geminiService.generateEmbedding(content);
            await this.prisma.knowledgeDocument.update({
              where: { id: existing.id },
              data: {
                title: lesson.title,
                content,
                embedding: JSON.stringify(embedding),
              },
            });

            try {
              if (
                Array.isArray(embedding) &&
                embedding.every((v) => typeof v === 'number')
              ) {
                const vectorText = `[${embedding.join(',')}]`;
                await this.prisma.$executeRawUnsafe(
                  `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
                  vectorText,
                  existing.id,
                );
              }
            } catch (e) {
              this.logger.warn(
                `Không thể update embedding_vector cho lesson ${lesson.id}`,
              );
            }
          } else {
            await this.addDocument({
              title: lesson.title,
              content,
              documentType: 'lesson',
              source: docId,
            });
          }

          indexed++;
        } catch (e) {
          this.logger.error(
            `❌ Lỗi index lesson ${lesson.id}: ${(e as any)?.message}`,
          );
          errors++;
        }
      }

      this.logger.log(`✅ Indexed ${indexed} lessons, ${errors} errors`);
      return { indexed, errors };
    } catch (e) {
      this.logger.error('❌ Lỗi index lessons:', e as any);
      throw e;
    }
  }

  /**
   * Index all vocabulary into knowledge base
   */
  async indexVocabulary(): Promise<{ indexed: number; errors: number }> {
    this.logger.log('📝 Bắt đầu index vocabulary...');
    let indexed = 0;
    let errors = 0;

    try {
      const vocabWords = await this.prisma.vocabulary.findMany({
        take: 1000, // Limit to prevent too many API calls
        orderBy: { frequency: 'desc' },
      });

      for (const vocab of vocabWords) {
        try {
          const content = this.formatVocabularyContent(vocab);
          const docId = `vocab_${vocab.id}`;

          const existing = await this.prisma.knowledgeDocument.findFirst({
            where: { source: docId },
          });

          if (existing) {
            const embedding =
              await this.geminiService.generateEmbedding(content);
            await this.prisma.knowledgeDocument.update({
              where: { id: existing.id },
              data: {
                title: `Vocabulary: ${vocab.word}`,
                content,
                embedding: JSON.stringify(embedding),
              },
            });

            try {
              if (
                Array.isArray(embedding) &&
                embedding.every((v) => typeof v === 'number')
              ) {
                const vectorText = `[${embedding.join(',')}]`;
                await this.prisma.$executeRawUnsafe(
                  `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
                  vectorText,
                  existing.id,
                );
              }
            } catch (e) {
              this.logger.warn(
                `Không thể update embedding_vector cho vocab ${vocab.id}`,
              );
            }
          } else {
            await this.addDocument({
              title: `Vocabulary: ${vocab.word}`,
              content,
              documentType: 'vocabulary',
              source: docId,
            });
          }

          indexed++;
        } catch (e) {
          this.logger.error(
            `❌ Lỗi index vocab ${vocab.word}: ${(e as any)?.message}`,
          );
          errors++;
        }
      }

      this.logger.log(`✅ Indexed ${indexed} vocabulary, ${errors} errors`);
      return { indexed, errors };
    } catch (e) {
      this.logger.error('❌ Lỗi index vocabulary:', e as any);
      throw e;
    }
  }

  /**
   * Index all activities into knowledge base
   */
  async indexActivities(): Promise<{ indexed: number; errors: number }> {
    this.logger.log('🎮 Bắt đầu index activities...');
    let indexed = 0;
    let errors = 0;

    try {
      const activities = await this.prisma.activity.findMany({
        include: {
          lesson: {
            select: {
              title: true,
              course: {
                select: {
                  title: true,
                },
              },
            },
          },
        },
        take: 500, // Limit to prevent too many API calls
      });

      for (const activity of activities) {
        try {
          const content = this.formatActivityContent(activity);
          const docId = `activity_${activity.id}`;

          const existing = await this.prisma.knowledgeDocument.findFirst({
            where: { source: docId },
          });

          if (existing) {
            const embedding =
              await this.geminiService.generateEmbedding(content);
            await this.prisma.knowledgeDocument.update({
              where: { id: existing.id },
              data: {
                title: activity.title,
                content,
                embedding: JSON.stringify(embedding),
              },
            });

            try {
              if (
                Array.isArray(embedding) &&
                embedding.every((v) => typeof v === 'number')
              ) {
                const vectorText = `[${embedding.join(',')}]`;
                await this.prisma.$executeRawUnsafe(
                  `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
                  vectorText,
                  existing.id,
                );
              }
            } catch (e) {
              this.logger.warn(
                `Không thể update embedding_vector cho activity ${activity.id}`,
              );
            }
          } else {
            await this.addDocument({
              title: activity.title,
              content,
              documentType: 'activity',
              source: docId,
            });
          }

          indexed++;
        } catch (e) {
          this.logger.error(
            `❌ Lỗi index activity ${activity.id}: ${(e as any)?.message}`,
          );
          errors++;
        }
      }

      this.logger.log(`✅ Indexed ${indexed} activities, ${errors} errors`);
      return { indexed, errors };
    } catch (e) {
      this.logger.error('❌ Lỗi index activities:', e as any);
      throw e;
    }
  }

  /**
   * Reindex all model data into knowledge base
   */
  async reindexAllModels(): Promise<{
    courses: { indexed: number; errors: number };
    lessons: { indexed: number; errors: number };
    vocabulary: { indexed: number; errors: number };
    activities: { indexed: number; errors: number };
  }> {
    this.logger.log('🔄 Bắt đầu reindex tất cả model data...');

    const results = {
      courses: await this.indexCourses(),
      lessons: await this.indexLessons(),
      vocabulary: await this.indexVocabulary(),
      activities: await this.indexActivities(),
    };

    const totalIndexed =
      results.courses.indexed +
      results.lessons.indexed +
      results.vocabulary.indexed +
      results.activities.indexed;
    const totalErrors =
      results.courses.errors +
      results.lessons.errors +
      results.vocabulary.errors +
      results.activities.errors;

    this.logger.log(
      `✅ Hoàn thành reindex: ${totalIndexed} documents indexed, ${totalErrors} errors`,
    );

    return results;
  }

  // Helper methods to format content for each model type
  private formatCourseContent(course: any): string {
    const instructor = course.instructor
      ? `${course.instructor.displayName || course.instructor.firstName + ' ' + course.instructor.lastName}`
      : 'N/A';

    return `
Khóa học: ${course.title}
Mô tả: ${course.description || 'Không có mô tả'}
Độ khó: ${course.difficulty}
Giáo viên: ${instructor}
Thời lượng ước tính: ${course.estimatedHours || 0} giờ
Giá: ${course.price || 0} ${course.currency || 'VND'}
Tags: ${(course.tags || []).join(', ')}
Yêu cầu: ${(course.prerequisites || []).join(', ') || 'Không có'}
Trạng thái: ${course.isPublished ? 'Đã xuất bản' : 'Chưa xuất bản'}
    `.trim();
  }

  private formatLessonContent(lesson: any): string {
    const courseName = lesson.course?.title || 'N/A';

    return `
Bài học: ${lesson.title}
Thuộc khóa học: ${courseName}
Mô tả: ${lesson.description || 'Không có mô tả'}
Độ khó: ${lesson.difficulty}
Thời gian ước tính: ${lesson.estimatedTime || 0} phút
Thứ tự: ${lesson.orderNo}
Mục tiêu: ${(lesson.objectives || []).join(', ') || 'Không có'}
Trạng thái: ${lesson.isLocked ? 'Đã khóa' : 'Mở'}
    `.trim();
  }

  private formatVocabularyContent(vocab: any): string {
    const examples = vocab.examples
      ? JSON.stringify(vocab.examples)
      : 'Không có ví dụ';

    return `
Từ vựng: ${vocab.word}
Định nghĩa: ${vocab.definition}
Phát âm: ${vocab.pronunciation || 'N/A'}
Độ khó: ${vocab.difficulty}
Danh mục: ${vocab.category || 'N/A'}
Tags: ${(vocab.tags || []).join(', ')}
Tần suất: ${vocab.frequency}
Ngôn ngữ: ${vocab.language}
Ví dụ: ${examples}
    `.trim();
  }

  private formatActivityContent(activity: any): string {
    const courseName = activity.lesson?.course?.title || 'N/A';
    const lessonName = activity.lesson?.title || 'N/A';
    const contentSummary =
      typeof activity.content === 'object'
        ? JSON.stringify(activity.content).substring(0, 200)
        : String(activity.content).substring(0, 200);

    return `
Hoạt động: ${activity.title}
Loại: ${activity.type}
Thuộc bài học: ${lessonName}
Thuộc khóa học: ${courseName}
Độ khó: ${activity.difficulty}
Điểm: ${activity.points}
Thời gian giới hạn: ${activity.timeLimit || 'Không giới hạn'} phút
Số lần thử tối đa: ${activity.maxAttempts || 'Không giới hạn'}
Điểm đạt: ${activity.passingScore || 'N/A'}
Hướng dẫn: ${activity.instructions || 'Không có'}
Nội dung: ${contentSummary}...
    `.trim();
  }
}
