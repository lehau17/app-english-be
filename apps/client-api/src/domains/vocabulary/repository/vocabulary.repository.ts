import { PrismaService } from '@app/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { SavedWord } from '@prisma/client';

@Injectable()
export class VocabularyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, word: string): Promise<SavedWord> {
    return this.prisma.savedWord.create({
      data: {
        userId,
        word: word.toLowerCase(),
      },
    });
  }

  async findByUserId(userId: string): Promise<SavedWord[]> {
    return this.prisma.savedWord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, word: string): Promise<SavedWord | null> {
    return this.prisma.savedWord.findUnique({
      where: {
        userId_word: {
          userId,
          word: word.toLowerCase(),
        },
      },
    });
  }

  async delete(userId: string, word: string): Promise<SavedWord> {
    return this.prisma.savedWord.delete({
      where: {
        userId_word: {
          userId,
          word: word.toLowerCase(),
        },
      },
    });
  }
}