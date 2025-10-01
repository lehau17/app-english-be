import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

config();

/**
 * Script to index model data (courses, lessons, activities, vocabulary) into knowledge base
 * 
 * This script allows you to bulk-index existing data from your models into the RAG knowledge base
 * so that users can search and ask questions about courses, lessons, etc.
 * 
 * Usage:
 *   cd english-learning
 *   GEMINI_API_KEY=... npm run reindex:models
 *   
 *   # Or index specific models:
 *   GEMINI_API_KEY=... MODEL=courses npm run reindex:models
 *   GEMINI_API_KEY=... MODEL=lessons npm run reindex:models
 *   GEMINI_API_KEY=... MODEL=vocabulary npm run reindex:models
 *   GEMINI_API_KEY=... MODEL=activities npm run reindex:models
 */

async function generateEmbedding(
  genAI: GoogleGenerativeAI,
  text: string,
): Promise<number[]> {
  try {
    const embeddingModel = genAI.getGenerativeModel({
      model: 'text-embedding-004',
    });
    const result: any = await embeddingModel.embedContent(text);
    return result?.embedding?.values || [];
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

async function indexCourses(prisma: PrismaClient, genAI: GoogleGenerativeAI) {
  console.log('📚 Indexing courses...');
  let indexed = 0;
  let errors = 0;

  const courses = await prisma.course.findMany({
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

      const docId = `course_${course.id}`;
      const existing = await prisma.knowledgeDocument.findFirst({
        where: { source: docId },
      });

      const embedding = await generateEmbedding(genAI, content);

      if (existing) {
        await prisma.knowledgeDocument.update({
          where: { id: existing.id },
          data: {
            title: course.title,
            content,
            embedding: JSON.stringify(embedding),
          },
        });

        // Update pgvector
        if (Array.isArray(embedding) && embedding.every((v) => typeof v === 'number')) {
          const vectorText = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
            vectorText,
            existing.id,
          );
        }
      } else {
        const doc = await prisma.knowledgeDocument.create({
          data: {
            title: course.title,
            content,
            documentType: 'course',
            source: docId,
            embedding: JSON.stringify(embedding),
          },
        });

        // Update pgvector
        if (Array.isArray(embedding) && embedding.every((v) => typeof v === 'number')) {
          const vectorText = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
            vectorText,
            doc.id,
          );
        }
      }

      indexed++;
      console.log(`✅ Indexed course: ${course.title}`);
    } catch (e) {
      console.error(`❌ Error indexing course ${course.id}:`, e);
      errors++;
    }
  }

  return { indexed, errors };
}

async function indexLessons(prisma: PrismaClient, genAI: GoogleGenerativeAI) {
  console.log('📖 Indexing lessons...');
  let indexed = 0;
  let errors = 0;

  const lessons = await prisma.lesson.findMany({
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

      const docId = `lesson_${lesson.id}`;
      const existing = await prisma.knowledgeDocument.findFirst({
        where: { source: docId },
      });

      const embedding = await generateEmbedding(genAI, content);

      if (existing) {
        await prisma.knowledgeDocument.update({
          where: { id: existing.id },
          data: {
            title: lesson.title,
            content,
            embedding: JSON.stringify(embedding),
          },
        });

        if (Array.isArray(embedding) && embedding.every((v) => typeof v === 'number')) {
          const vectorText = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
            vectorText,
            existing.id,
          );
        }
      } else {
        const doc = await prisma.knowledgeDocument.create({
          data: {
            title: lesson.title,
            content,
            documentType: 'lesson',
            source: docId,
            embedding: JSON.stringify(embedding),
          },
        });

        if (Array.isArray(embedding) && embedding.every((v) => typeof v === 'number')) {
          const vectorText = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
            vectorText,
            doc.id,
          );
        }
      }

      indexed++;
      console.log(`✅ Indexed lesson: ${lesson.title}`);
    } catch (e) {
      console.error(`❌ Error indexing lesson ${lesson.id}:`, e);
      errors++;
    }
  }

  return { indexed, errors };
}

async function indexVocabulary(prisma: PrismaClient, genAI: GoogleGenerativeAI) {
  console.log('📝 Indexing vocabulary...');
  let indexed = 0;
  let errors = 0;

  const vocabWords = await prisma.vocabulary.findMany({
    take: 1000,
    orderBy: { frequency: 'desc' },
  });

  for (const vocab of vocabWords) {
    try {
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

      const docId = `vocab_${vocab.id}`;
      const existing = await prisma.knowledgeDocument.findFirst({
        where: { source: docId },
      });

      const embedding = await generateEmbedding(genAI, content);

      if (existing) {
        await prisma.knowledgeDocument.update({
          where: { id: existing.id },
          data: {
            title: `Vocabulary: ${vocab.word}`,
            content,
            embedding: JSON.stringify(embedding),
          },
        });

        if (Array.isArray(embedding) && embedding.every((v) => typeof v === 'number')) {
          const vectorText = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
            vectorText,
            existing.id,
          );
        }
      } else {
        const doc = await prisma.knowledgeDocument.create({
          data: {
            title: `Vocabulary: ${vocab.word}`,
            content,
            documentType: 'vocabulary',
            source: docId,
            embedding: JSON.stringify(embedding),
          },
        });

        if (Array.isArray(embedding) && embedding.every((v) => typeof v === 'number')) {
          const vectorText = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
            vectorText,
            doc.id,
          );
        }
      }

      indexed++;
      console.log(`✅ Indexed vocab: ${vocab.word}`);
    } catch (e) {
      console.error(`❌ Error indexing vocab ${vocab.word}:`, e);
      errors++;
    }
  }

  return { indexed, errors };
}

async function indexActivities(prisma: PrismaClient, genAI: GoogleGenerativeAI) {
  console.log('🎮 Indexing activities...');
  let indexed = 0;
  let errors = 0;

  const activities = await prisma.activity.findMany({
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
    take: 500,
  });

  for (const activity of activities) {
    try {
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

      const docId = `activity_${activity.id}`;
      const existing = await prisma.knowledgeDocument.findFirst({
        where: { source: docId },
      });

      const embedding = await generateEmbedding(genAI, content);

      if (existing) {
        await prisma.knowledgeDocument.update({
          where: { id: existing.id },
          data: {
            title: activity.title,
            content,
            embedding: JSON.stringify(embedding),
          },
        });

        if (Array.isArray(embedding) && embedding.every((v) => typeof v === 'number')) {
          const vectorText = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
            vectorText,
            existing.id,
          );
        }
      } else {
        const doc = await prisma.knowledgeDocument.create({
          data: {
            title: activity.title,
            content,
            documentType: 'activity',
            source: docId,
            embedding: JSON.stringify(embedding),
          },
        });

        if (Array.isArray(embedding) && embedding.every((v) => typeof v === 'number')) {
          const vectorText = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
            vectorText,
            doc.id,
          );
        }
      }

      indexed++;
      console.log(`✅ Indexed activity: ${activity.title}`);
    } catch (e) {
      console.error(`❌ Error indexing activity ${activity.id}:`, e);
      errors++;
    }
  }

  return { indexed, errors };
}

async function main() {
  const prisma = new PrismaClient();
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const modelType = process.env.MODEL || 'all';

  console.log('🔄 Starting model data indexing...');
  console.log(`Model type: ${modelType}`);

  const results: any = {};

  try {
    if (modelType === 'all' || modelType === 'courses') {
      results.courses = await indexCourses(prisma, genAI);
      console.log(`\n📚 Courses: ${results.courses.indexed} indexed, ${results.courses.errors} errors`);
    }

    if (modelType === 'all' || modelType === 'lessons') {
      results.lessons = await indexLessons(prisma, genAI);
      console.log(`\n📖 Lessons: ${results.lessons.indexed} indexed, ${results.lessons.errors} errors`);
    }

    if (modelType === 'all' || modelType === 'vocabulary') {
      results.vocabulary = await indexVocabulary(prisma, genAI);
      console.log(`\n📝 Vocabulary: ${results.vocabulary.indexed} indexed, ${results.vocabulary.errors} errors`);
    }

    if (modelType === 'all' || modelType === 'activities') {
      results.activities = await indexActivities(prisma, genAI);
      console.log(`\n🎮 Activities: ${results.activities.indexed} indexed, ${results.activities.errors} errors`);
    }

    const totalIndexed = Object.values(results).reduce(
      (sum: number, r: any) => sum + (r?.indexed || 0),
      0,
    );
    const totalErrors = Object.values(results).reduce(
      (sum: number, r: any) => sum + (r?.errors || 0),
      0,
    );

    console.log('\n✅ Indexing complete!');
    console.log(`Total indexed: ${totalIndexed}`);
    console.log(`Total errors: ${totalErrors}`);
  } catch (e) {
    console.error('❌ Fatal error during indexing:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
