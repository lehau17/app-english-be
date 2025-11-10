import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateVocabularyListDto,
  GetVocabularyListsQueryDto,
  PaginatedVocabularyListsResponseDto,
  UpdateVocabularyListDto,
  VocabularyListResponseDto,
} from '../dto/vocabulary-list.dto';
import { VocabularyRepository } from '../repository/vocabulary.repository';

@Injectable()
export class VocabularyListService {
  constructor(private readonly repository: VocabularyRepository) {}

  /**
   * Get public vocabulary lists with pagination and filters
   */
  async getPublicLists(
    query: GetVocabularyListsQueryDto,
    userId?: string,
  ): Promise<PaginatedVocabularyListsResponseDto> {
    const {
      category,
      difficulty,
      search,
      officialOnly,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.VocabularyListWhereInput = {
      isPublic: true,
    };

    if (officialOnly) {
      where.isOfficial = true;
    }

    if (category) {
      where.category = category;
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [lists, total] = await Promise.all([
      this.repository.findLists({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.repository.countLists(where),
    ]);

    // Get user progress if authenticated
    const data = await Promise.all(
      lists.map(async (list) => {
        const responseDto: VocabularyListResponseDto = {
          ...list,
          difficulty: list.difficulty as string,
          language: list.language as string,
        };

        if (userId) {
          const userList = await this.repository.findUserList(userId, list.id);
          if (userList) {
            responseDto.userProgress = {
              completedTerms: userList.completedTerms,
              totalTerms: userList.totalTerms,
              lastStudiedAt: userList.lastStudiedAt || undefined,
              addedAt: userList.addedAt,
            };
          }
        }

        return responseDto;
      }),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single list by ID
   */
  async getList(
    listId: string,
    userId?: string,
  ): Promise<VocabularyListResponseDto> {
    const list = await this.repository.findListById(listId, true);

    if (!list) {
      throw new NotFoundException(
        `Vocabulary list with ID ${listId} not found`,
      );
    }

    const responseDto: VocabularyListResponseDto = {
      ...list,
      difficulty: list.difficulty as string,
      language: list.language as string,
    };

    if (userId) {
      const userList = await this.repository.findUserList(userId, list.id);
      if (userList) {
        responseDto.userProgress = {
          completedTerms: userList.completedTerms,
          totalTerms: userList.totalTerms,
          lastStudiedAt: userList.lastStudiedAt || undefined,
          addedAt: userList.addedAt,
        };
      }
    }

    return responseDto;
  }

  /**
   * Get user's vocabulary lists
   */
  async getUserLists(userId: string): Promise<VocabularyListResponseDto[]> {
    const userLists = await this.repository.findUserLists(userId);

    return userLists.map((userList) => ({
      ...userList.list,
      difficulty: userList.list.difficulty as string,
      language: userList.list.language as string,
      userProgress: {
        completedTerms: userList.completedTerms,
        totalTerms: userList.totalTerms,
        lastStudiedAt: userList.lastStudiedAt || undefined,
        addedAt: userList.addedAt,
      },
    }));
  }

  /**
   * Add list to user's collection
   */
  async addListToUser(userId: string, listId: string): Promise<void> {
    // Check if list exists
    const list = await this.repository.findListById(listId);
    if (!list) {
      throw new NotFoundException(
        `Vocabulary list with ID ${listId} not found`,
      );
    }

    // Check if already added
    const existing = await this.repository.findUserList(userId, listId);
    if (existing) {
      throw new ConflictException('List already added to your collection');
    }

    // Get total terms count
    const { totalTerms } = await this.repository.getListStats(listId);

    // Add to user's collection
    await this.repository.addListToUser(userId, listId, totalTerms);

    // Increment user count
    await this.repository.incrementListUserCount(listId);
  }

  /**
   * Remove list from user's collection
   */
  async removeListFromUser(userId: string, listId: string): Promise<void> {
    const userList = await this.repository.findUserList(userId, listId);
    if (!userList) {
      throw new NotFoundException('List not found in your collection');
    }

    await this.repository.removeListFromUser(userId, listId);

    // Decrement user count
    await this.repository.decrementListUserCount(listId);
  }

  /**
   * Create new list (Admin/Teacher)
   */
  async createList(
    dto: CreateVocabularyListDto,
    creatorId: string,
  ): Promise<VocabularyListResponseDto> {
    const list = await this.repository.createList({
      title: dto.title,
      description: dto.description,
      difficulty: dto.difficulty,
      category: dto.category,
      level: dto.level,
      thumbnailUrl: dto.thumbnailUrl,
      bannerUrl: dto.bannerUrl,
      isPublic: dto.isPublic ?? true,
      language: dto.language || 'en',
      creator: {
        connect: { id: creatorId },
      },
    });

    return {
      ...list,
      difficulty: list.difficulty as string,
      language: list.language as string,
    };
  }

  /**
   * Update list (Admin/Teacher/Owner)
   */
  async updateList(
    listId: string,
    dto: UpdateVocabularyListDto,
    userId: string,
  ): Promise<VocabularyListResponseDto> {
    const list = await this.repository.findListById(listId);
    if (!list) {
      throw new NotFoundException(
        `Vocabulary list with ID ${listId} not found`,
      );
    }

    // Check ownership (if not admin, must be creator)
    if (list.createdBy && list.createdBy !== userId) {
      throw new ForbiddenException(
        'You do not have permission to edit this list',
      );
    }

    const updated = await this.repository.updateList(listId, dto);

    return {
      ...updated,
      difficulty: updated.difficulty as string,
      language: updated.language as string,
    };
  }

  /**
   * Delete list (Admin/Owner)
   */
  async deleteList(listId: string, userId: string): Promise<void> {
    const list = await this.repository.findListById(listId);
    if (!list) {
      throw new NotFoundException(
        `Vocabulary list with ID ${listId} not found`,
      );
    }

    // Check ownership
    if (list.createdBy && list.createdBy !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this list',
      );
    }

    await this.repository.deleteList(listId);
  }

  /**
   * Update list stats (cached totals)
   */
  async updateListStats(listId: string): Promise<void> {
    const { totalTerms, totalUnits } =
      await this.repository.getListStats(listId);

    await this.repository.updateList(listId, {
      totalTerms,
      totalUnits,
    });
  }
}
