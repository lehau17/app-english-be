import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { MediaFile, Prisma } from '@prisma/client';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async findByUrl(url: string): Promise<MediaFile | null> {
    return this.prisma.mediaFile.findFirst({
      where: { url },
    });
  }

  async findById(id: string): Promise<MediaFile | null> {
    return this.prisma.mediaFile.findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.MediaFileCreateInput): Promise<MediaFile> {
    return this.prisma.mediaFile.create({ data });
  }

  async update(
    id: string,
    data: Prisma.MediaFileUpdateInput,
  ): Promise<MediaFile> {
    return this.prisma.mediaFile.update({
      where: { id },
      data,
    });
  }

  async findBySource(source: string, sourceId?: string): Promise<MediaFile[]> {
    return this.prisma.mediaFile.findMany({
      where: {
        source,
        ...(sourceId && { sourceId }),
      },
    });
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
    const {
      page = 1,
      limit = 20,
      mimeType,
      source,
      sourceId,
      tags,
      category,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.MediaFileWhereInput = {};
    if (mimeType) where.mimeType = { contains: mimeType, mode: 'insensitive' };
    if (source) where.source = source;
    if (sourceId) where.sourceId = sourceId;
    if (category) where.category = category;
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    const [data, total] = await Promise.all([
      this.prisma.mediaFile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mediaFile.count({ where }),
    ]);

    return { data, total };
  }

  async saveEmbedding(mediaId: string, embedding: number[]): Promise<void> {
    const vectorText = `[${embedding.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "MediaFile" SET embedding_vector = $1::vector WHERE id = $2`,
      vectorText,
      mediaId,
    );
  }

  getPrisma() {
    return this.prisma;
  }
}
