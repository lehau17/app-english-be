import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import fetch from 'node-fetch';

config();

/**
 * Backfill script: for each knowledge_document, if embedding_vector is null,
 * attempt to parse `embedding` JSON (if present) and write the pgvector column.
 * If `embedding` is missing, call embedding API to generate and then write.
 *
 * Usage:
 *   cd english-learning
 *   GEMINI_API_KEY=... ts-node scripts/backfill-embedding-vector.ts
 */

async function main() {
  const prisma = new PrismaClient();
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    console.error('GEMINI_API_KEY not set');
    process.exit(1);
  }

  async function generateEmbedding(text: string): Promise<number[]> {
    const resp = await fetch('https://generativeai.googleapis.com/v1beta2/models/text-embedding-004:embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GEMINI_KEY}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Embedding API failed: ${resp.status} ${t}`);
    }
    const j: any = await resp.json();
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
        // Skip if already has vector
        const row = await prisma.$queryRawUnsafe<any[]>(
          `SELECT embedding_vector IS NOT NULL as has_vector FROM knowledge_documents WHERE id = $1`,
          d.id,
        );
        if (row && row[0] && row[0].has_vector) {
          console.log(`Skipping ${d.id} (already has vector)`);
          continue;
        }

        let emb: number[] = [];
        if (d.embedding) {
          try {
            emb = JSON.parse(d.embedding as any) as number[];
          } catch (e) {
            emb = [];
          }
        }

        if (!emb || emb.length === 0) {
          emb = await generateEmbedding(d.content || '');
        }

        if (!emb || emb.length === 0) {
          console.warn(`No embedding for doc ${d.id}`);
          continue;
        }

        const vectorText = `[${emb.join(',')}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE knowledge_documents SET embedding_vector = '${vectorText}'::vector WHERE id = $1`,
          d.id,
        );
        console.log(`Updated doc ${d.id}`);
      } catch (e) {
        console.error('Failed to update doc', d.id, (e as any)?.message || e);
      }
    }

    offset += docs.length;
  }

  console.log('Backfill complete');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
