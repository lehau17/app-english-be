import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import fetch from 'node-fetch';

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

  // Simple helper to call the same GoogleGenerativeAI usage as GeminiService
  async function generateEmbedding(text: string): Promise<number[]> {
    // Minimal fetch wrapper to call Google Generative AI embeddings endpoint.
    // NOTE: You may prefer to import existing GeminiService; this keeps script standalone.
    const resp = await fetch('https://generativeai.googleapis.com/v1beta2/models/text-embedding-004:embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GEMINI_KEY}`,
      },
      body: JSON.stringify({
        text: text,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Embedding API failed: ${resp.status} ${t}`);
    }

  const j: any = await resp.json();
  // Adjust according to actual API shape; fallback: search for embedding in response
  const embedding = (j && (j.embedding?.values || j.data?.[0]?.embedding)) || [];
    return embedding;
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
        const vectorText = `[${emb.join(',')}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE knowledge_document SET embedding_vector = '${vectorText}'::vector WHERE id = '${d.id}'`,
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
