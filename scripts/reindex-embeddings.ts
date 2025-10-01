import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

config();

/**
 * Script đơn giản để re-index tất cả document: sinh embedding bằng Gemini API
 * và ghi vào cột embedding_vector.
 *
 * Usage:
 *   cd english-learning
 *   GEMINI_API_KEY=... node -r ts-node/register scripts/reindex-embeddings.ts
 *
 * Chạy theo batch để tránh bị rate limit.
 */

async function main() {
  const prisma = new PrismaClient();
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    console.error('GEMINI_API_KEY not set');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(GEMINI_KEY);

  // Simple helper to call the same GoogleGenerativeAI usage as GeminiService
  async function generateEmbedding(text: string): Promise<number[]> {
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

  const batchSize = Number(process.env.BATCH_SIZE) || 100;
  let offset = 0;

  while (true) {
    const docs = await prisma.knowledgeDocument.findMany({
      skip: offset,
      take: batchSize,
      where: {},
      orderBy: { id: 'asc' },
    });
    if (docs.length === 0) break;

    console.log(`Processing batch offset=${offset} size=${docs.length}`);

    for (const d of docs) {
      try {
        const emb = await generateEmbedding(d.content || '');
        
        // Validate embedding
        if (!Array.isArray(emb) || emb.length === 0) {
          console.warn(`Empty embedding for doc ${d.id}`);
          continue;
        }
        if (emb.some(v => typeof v !== 'number' || !isFinite(v))) {
          console.warn(`Invalid embedding values for doc ${d.id}`);
          continue;
        }

        const vectorText = `[${emb.join(',')}]`;
        // Use parameterized query to prevent SQL injection
        await prisma.$executeRawUnsafe(
          `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
          vectorText,
          d.id
        );
        console.log(`Updated doc ${d.id}`);
      } catch (e) {
        console.error('Failed to update doc', d.id, e);
      }
    }

    offset += docs.length;
  }

  console.log('Reindex complete');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
