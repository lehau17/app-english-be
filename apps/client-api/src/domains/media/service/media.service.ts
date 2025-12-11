import {
  GeminiService,
  KafkaProducerService,
  KafkaTopic,
  MediaProcessingMessage,
} from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { MediaFile } from '@prisma/client';
import { MediaContext } from '../interfaces/media-context.interface';
import { MediaRepository } from '../repository/media.repository';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly repository: MediaRepository,
    private readonly geminiService: GeminiService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async findByUrl(url: string): Promise<MediaFile | null> {
    return this.repository.findByUrl(url);
  }

  async findById(id: string): Promise<MediaFile | null> {
    return this.repository.findById(id);
  }

  async findBySource(source: string, sourceId?: string): Promise<MediaFile[]> {
    return this.repository.findBySource(source, sourceId);
  }

  async createFromContext(
    url: string,
    context: MediaContext,
  ): Promise<MediaFile> {
    // Check if MediaFile already exists
    const existing = await this.repository.findByUrl(url);
    if (existing) {
      this.logger.log(`MediaFile already exists for URL: ${url}`);
      return existing;
    }

    // Extract metadata from URL
    const urlObj = new URL(url);
    const filename = urlObj.pathname.split('/').pop() || 'unknown';
    const originalName = filename;
    const mimeType = this.inferMimeType(url);
    const size = 0; // Size not available from URL

    // Extract tags and description from context
    const tags = this.extractTagsFromContext(context);
    const description = this.generateDescriptionFromContext(context);

    // Create MediaFile
    const mediaFile = await this.repository.create({
      url,
      filename,
      originalName,
      mimeType,
      size,
      tags,
      description,
      category: context.category,
      source: context.source,
      sourceId: context.sourceId,
      context: context as any,
      isProcessed: false,
      usageCount: 0,
    });

    // Generate embedding asynchronously (don't block)
    this.generateAndSaveEmbedding(mediaFile.id, context).catch((error) => {
      this.logger.error(
        `Failed to generate embedding for media ${mediaFile.id}:`,
        error,
      );
    });

    // Emit Kafka event for media processing (thumbnail, duration)
    this.emitMediaProcessingEvent(mediaFile).catch((error) => {
      this.logger.error(
        `Failed to emit media processing event for ${mediaFile.id}:`,
        error,
      );
    });

    return mediaFile;
  }

  extractTagsFromContext(context: MediaContext): string[] {
    const tags: string[] = [];

    // From vocabulary term
    if (context.word) {
      tags.push(context.word.toLowerCase());
      // Extract keywords from definition
      if (context.definition) {
        const words = context.definition
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .slice(0, 3);
        tags.push(...words);
      }
    }

    // From activity
    if (context.activityTitle) {
      const words = context.activityTitle
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 3);
      tags.push(...words);
    }

    if (context.activityType) {
      tags.push(context.activityType.toLowerCase());
    }

    // From podcast
    if (context.podcastTitle) {
      const words = context.podcastTitle
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 3);
      tags.push(...words);
    }

    if (context.category) {
      tags.push(context.category.toLowerCase());
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  generateDescriptionFromContext(context: MediaContext): string {
    const parts: string[] = [];

    if (context.source === 'vocabulary_term' && context.word) {
      parts.push(`Image for vocabulary term: ${context.word}`);
      if (context.definition) {
        parts.push(context.definition);
      }
    } else if (context.source === 'course_activity' && context.activityTitle) {
      parts.push(`Media for activity: ${context.activityTitle}`);
      if (context.courseTitle) {
        parts.push(`in course: ${context.courseTitle}`);
      }
      if (context.lessonTitle) {
        parts.push(`lesson: ${context.lessonTitle}`);
      }
    } else if (
      context.source === 'assignment_activity' &&
      context.activityTitle
    ) {
      parts.push(`Media for assignment activity: ${context.activityTitle}`);
      if (context.assignmentTitle) {
        parts.push(`in assignment: ${context.assignmentTitle}`);
      }
    } else if (context.source === 'podcast' && context.podcastTitle) {
      parts.push(`Media for podcast: ${context.podcastTitle}`);
      if (context.category) {
        parts.push(`category: ${context.category}`);
      }
    }

    return parts.join('. ') || 'Media file';
  }

  async generateEmbeddingFromContext(context: MediaContext): Promise<number[]> {
    const description = this.generateDescriptionFromContext(context);
    const contextText = JSON.stringify(context);
    const text = `${description}. Context: ${contextText}`;
    return this.geminiService.generateEmbedding(text);
  }

  async saveEmbeddingToVector(
    mediaId: string,
    embedding: number[],
  ): Promise<void> {
    await this.repository.saveEmbedding(mediaId, embedding);
  }

  private async generateAndSaveEmbedding(
    mediaId: string,
    context: MediaContext,
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbeddingFromContext(context);
      await this.saveEmbeddingToVector(mediaId, embedding);
      this.logger.log(`Generated and saved embedding for media ${mediaId}`);
    } catch (error) {
      this.logger.error(
        `Failed to generate embedding for media ${mediaId}:`,
        error,
      );
    }
  }

  private inferMimeType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
    };
    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  async list(params: {
    mimeType?: string;
    source?: string;
    sourceId?: string;
    tags?: string[];
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: MediaFile[]; total: number }> {
    return this.repository.list(params);
  }

  async fulltextSearch(
    query: string,
    filters?: { mimeType?: string; category?: string },
  ): Promise<Array<MediaFile & { fulltextScore: number }>> {
    const sanitizedQuery = query.replace(/[^\w\s]/g, ' ').trim();
    if (!sanitizedQuery) {
      return [];
    }

    const prisma = this.repository.getPrisma();
    const searchVector = `to_tsvector('english',
      coalesce(filename, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      array_to_string(tags, ' ')
    )`;

    let sql = `SELECT
      id, filename, description, tags, category, url, mimeType, thumbnail, size, "isProcessed", duration, "usageCount", source, "sourceId", context, "createdAt", "updatedAt",
      ts_rank(${searchVector}, plainto_tsquery('english', $1)) as rank
    FROM "MediaFile"
    WHERE ${searchVector} @@ plainto_tsquery('english', $1)`;

    const params: any[] = [sanitizedQuery];
    let paramIndex = 2;

    if (filters?.mimeType) {
      sql += ` AND mimeType = $${paramIndex}`;
      params.push(filters.mimeType);
      paramIndex++;
    }

    if (filters?.category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    sql += ` ORDER BY rank DESC LIMIT 20`;

    const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);

    return (rows || []).map((r: any) => ({
      ...r,
      fulltextScore: Number(r.rank) || 0,
    }));
  }

  async vectorSearch(
    query: string,
    filters?: { mimeType?: string; category?: string },
  ): Promise<Array<MediaFile & { vectorScore: number }>> {
    try {
      const queryEmbedding = await this.geminiService.generateEmbedding(query);
      const vectorText = `[${queryEmbedding.join(',')}]`;

      const prisma = this.repository.getPrisma();
      let sql = `SELECT
        id, filename, description, tags, category, url, mimeType, thumbnail, size, "isProcessed", duration, "usageCount", source, "sourceId", context, "createdAt", "updatedAt",
        1 - (embedding_vector <-> $1::vector) as similarity
      FROM "MediaFile"
      WHERE embedding_vector IS NOT NULL`;

      const params: any[] = [vectorText];
      let paramIndex = 2;

      if (filters?.mimeType) {
        sql += ` AND mimeType = $${paramIndex}`;
        params.push(filters.mimeType);
        paramIndex++;
      }

      if (filters?.category) {
        sql += ` AND category = $${paramIndex}`;
        params.push(filters.category);
        paramIndex++;
      }

      sql += ` ORDER BY embedding_vector <-> $1::vector LIMIT 20`;

      const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);

      return (rows || []).map((r: any) => ({
        ...r,
        vectorScore: Number(r.similarity) || 0,
      }));
    } catch (error) {
      this.logger.warn('Vector search failed: ' + (error as any)?.message);
      return [];
    }
  }

  async hybridSearch(
    query: string,
    filters?: { mimeType?: string; category?: string },
  ): Promise<MediaFile[]> {
    // Run both searches in parallel
    const [fulltextResults, vectorResults] = await Promise.all([
      this.fulltextSearch(query, filters),
      this.vectorSearch(query, filters),
    ]);

    // Merge and rank
    const merged = new Map<string, any>();

    // Add fulltext results (weight: 0.6)
    fulltextResults.forEach((item) => {
      merged.set(item.id, {
        ...item,
        finalScore: item.fulltextScore * 0.6,
      });
    });

    // Add vector results (weight: 0.4)
    vectorResults.forEach((item) => {
      const existing = merged.get(item.id);
      if (existing) {
        existing.finalScore += item.vectorScore * 0.4;
      } else {
        merged.set(item.id, {
          ...item,
          finalScore: item.vectorScore * 0.4,
        });
      }
    });

    // Sort by final score
    return Array.from(merged.values())
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 20);
  }

  async search(
    query: string,
    filters?: { mimeType?: string; category?: string },
  ): Promise<MediaFile[]> {
    return this.hybridSearch(query, filters);
  }

  private async emitMediaProcessingEvent(mediaFile: MediaFile): Promise<void> {
    const message: MediaProcessingMessage = {
      operation: 'PROCESS',
      mediaId: mediaFile.id,
      mimeType: mediaFile.mimeType,
      url: mediaFile.url,
      processingOptions: {
        generateThumbnail: mediaFile.mimeType.startsWith('video/'),
        extractDuration:
          mediaFile.mimeType.startsWith('video/') ||
          mediaFile.mimeType.startsWith('audio/'),
      },
      timestamp: Date.now(),
    };

    await this.kafkaProducer.send(KafkaTopic.MEDIA_PROCESSING, message);
    this.logger.log(`Emitted media processing event for ${mediaFile.id}`);
  }
}
