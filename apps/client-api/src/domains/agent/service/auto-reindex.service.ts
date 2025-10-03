import { PrismaRepository } from '@app/database';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';
import { RagService } from './rag.service';

interface ReindexEvent {
  model: string;
  action: 'create' | 'update' | 'delete';
  id: string;
  data?: any;
}

@Injectable()
export class AutoReindexService implements OnModuleInit {
  private readonly logger = new Logger(AutoReindexService.name);
  private readonly eventEmitter = new EventEmitter();
  private isInitialized = false;

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly ragService: RagService,
  ) {
    // Set up event listener
    this.eventEmitter.on('knowledge.reindex', this.handleReindexEvent.bind(this));
  }

  async onModuleInit() {
    if (this.isInitialized) return;

    this.logger.log('🔧 Initializing Auto-Reindex Service...');

    // Set up Prisma middleware for auto-reindex
    this.setupPrismaMiddleware();

    this.isInitialized = true;
    this.logger.log('✅ Auto-Reindex Service initialized successfully');
  }

  private setupPrismaMiddleware() {
    this.prisma.$use(async (params, next) => {
      const result = await next(params);

      // Only handle specific models and operations
      const watchedModels = ['course', 'lesson', 'activity', 'vocabulary'];
      const watchedActions = ['create', 'update', 'delete', 'createMany', 'updateMany'];

      if (
        watchedModels.includes(params.model?.toLowerCase() || '') &&
        watchedActions.includes(params.action)
      ) {
        // Emit event for reindexing (async, non-blocking)
        setImmediate(() => {
          this.eventEmitter.emit('knowledge.reindex', {
            model: params.model?.toLowerCase(),
            action: params.action,
            id: this.extractId(result, params),
            data: result,
          } as ReindexEvent);
        });
      }

      return result;
    });

    this.logger.log('📝 Prisma middleware for auto-reindex set up');
  }

  private extractId(result: any, params: any): string {
    // Extract ID based on operation type
    if (params.action === 'delete') {
      return params.where?.id || 'unknown';
    }

    if (result?.id) {
      return result.id;
    }

    if (Array.isArray(result) && result.length > 0 && result[0]?.id) {
      return result[0].id;
    }

    return params.where?.id || 'unknown';
  }

  async handleReindexEvent(event: ReindexEvent) {
    try {
      this.logger.log(
        `📚 Auto-reindexing ${event.model} (${event.action}) - ID: ${event.id}`
      );

      switch (event.model) {
        case 'course':
          await this.reindexSingleCourse(event);
          break;
        case 'lesson':
          await this.reindexSingleLesson(event);
          break;
        case 'activity':
          await this.reindexSingleActivity(event);
          break;
        case 'vocabulary':
          await this.reindexSingleVocabulary(event);
          break;
        default:
          this.logger.warn(`Unsupported model for reindex: ${event.model}`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to auto-reindex ${event.model} ${event.id}:`,
        error
      );
    }
  }

  private async reindexSingleCourse(event: ReindexEvent) {
    const docId = `course_${event.id}`;

    if (event.action === 'delete') {
      // Remove from knowledge base
      await this.removeFromKnowledgeBase(docId);
      return;
    }

    // Get fresh course data
    const course = await this.prisma.course.findUnique({
      where: { id: event.id },
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

    if (!course) {
      this.logger.warn(`Course ${event.id} not found for reindexing`);
      return;
    }

    // Format content
    const instructor = course.instructor
      ? `${course.instructor.displayName || course.instructor.firstName + ' ' + course.instructor.lastName}`
      : 'N/A';

    const content = `
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

    // Update or create in knowledge base
    await this.upsertKnowledgeDocument({
      title: course.title,
      content,
      documentType: 'course',
      source: docId,
    });
  }

  private async reindexSingleLesson(event: ReindexEvent) {
    const docId = `lesson_${event.id}`;

    if (event.action === 'delete') {
      await this.removeFromKnowledgeBase(docId);
      return;
    }

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: event.id },
      include: {
        course: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!lesson) {
      this.logger.warn(`Lesson ${event.id} not found for reindexing`);
      return;
    }

    const courseName = lesson.course?.title || 'N/A';

    const content = `
Bài học: ${lesson.title}
Thuộc khóa học: ${courseName}
Mô tả: ${lesson.description || 'Không có mô tả'}
Độ khó: ${lesson.difficulty}
Thời gian ước tính: ${lesson.estimatedTime || 0} phút
Thứ tự: ${lesson.orderNo}
Mục tiêu: ${(lesson.objectives || []).join(', ') || 'Không có'}
Trạng thái: ${lesson.isLocked ? 'Đã khóa' : 'Mở'}
    `.trim();

    await this.upsertKnowledgeDocument({
      title: lesson.title,
      content,
      documentType: 'lesson',
      source: docId,
    });
  }

  private async reindexSingleActivity(event: ReindexEvent) {
    const docId = `activity_${event.id}`;

    if (event.action === 'delete') {
      await this.removeFromKnowledgeBase(docId);
      return;
    }

    const activity = await this.prisma.activity.findUnique({
      where: { id: event.id },
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
    });

    if (!activity) {
      this.logger.warn(`Activity ${event.id} not found for reindexing`);
      return;
    }

    const courseName = activity.lesson?.course?.title || 'N/A';
    const lessonName = activity.lesson?.title || 'N/A';
    const contentSummary =
      typeof activity.content === 'object'
        ? JSON.stringify(activity.content).substring(0, 200)
        : String(activity.content).substring(0, 200);

    const content = `
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

    await this.upsertKnowledgeDocument({
      title: activity.title,
      content,
      documentType: 'activity',
      source: docId,
    });
  }

  private async reindexSingleVocabulary(event: ReindexEvent) {
    const docId = `vocab_${event.id}`;

    if (event.action === 'delete') {
      await this.removeFromKnowledgeBase(docId);
      return;
    }

    const vocab = await this.prisma.vocabulary.findUnique({
      where: { id: event.id },
    });

    if (!vocab) {
      this.logger.warn(`Vocabulary ${event.id} not found for reindexing`);
      return;
    }

    const examples = vocab.examples
      ? JSON.stringify(vocab.examples)
      : 'Không có ví dụ';

    const content = `
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

    await this.upsertKnowledgeDocument({
      title: `Vocabulary: ${vocab.word}`,
      content,
      documentType: 'vocabulary',
      source: docId,
    });
  }

  private async upsertKnowledgeDocument(doc: {
    title: string;
    content: string;
    documentType: string;
    source: string;
  }) {
    try {
      // Check if document already exists
      const existing = await this.prisma.knowledgeDocument.findFirst({
        where: { source: doc.source },
      });

      if (existing) {
        // Delete the old document first
        await this.prisma.knowledgeDocument.delete({
          where: { id: existing.id },
        });

        // Create new document using RagService
        await this.ragService.addDocument(doc);
        this.logger.log(`✅ Updated knowledge document: ${doc.source}`);
      } else {
        // Create new document using RagService
        await this.ragService.addDocument(doc);
        this.logger.log(`✅ Created knowledge document: ${doc.source}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to upsert knowledge document ${doc.source}:`, error);
      throw error;
    }
  }

  private async removeFromKnowledgeBase(source: string) {
    try {
      const deleted = await this.prisma.knowledgeDocument.deleteMany({
        where: { source },
      });

      if (deleted.count > 0) {
        this.logger.log(`✅ Removed knowledge document: ${source}`);
      } else {
        this.logger.warn(`Knowledge document not found for deletion: ${source}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to remove knowledge document ${source}:`, error);
      throw error;
    }
  }

  /**
   * Manual trigger for reindexing specific entity
   */
  async manualReindex(model: string, id: string, action: 'create' | 'update' | 'delete' = 'update') {
    this.eventEmitter.emit('knowledge.reindex', {
      model: model.toLowerCase(),
      action,
      id,
    } as ReindexEvent);
  }

  /**
   * Get auto-reindex statistics
   */
  async getStats() {
    const knowledgeCount = await this.prisma.knowledgeDocument.count();
    const courseCount = await this.prisma.course.count();
    const lessonCount = await this.prisma.lesson.count();
    const activityCount = await this.prisma.activity.count();
    const vocabCount = await this.prisma.vocabulary.count();

    return {
      knowledgeDocuments: knowledgeCount,
      sourceEntities: {
        courses: courseCount,
        lessons: lessonCount,
        activities: activityCount,
        vocabulary: vocabCount,
      },
      isAutoReindexEnabled: this.isInitialized,
    };
  }
}
