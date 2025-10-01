import { PrismaRepository } from '@app/database';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreatePodcastCommentDto,
  ReportCommentDto,
  UpdatePodcastCommentDto,
} from './podcast-comment.dto';

@Injectable()
export class PodcastCommentService {
  constructor(private readonly prisma: PrismaRepository) {}

  async createComment(
    userId: string,
    createCommentDto: CreatePodcastCommentDto,
  ) {
    const { podcastId, parentId, content } = createCommentDto;

    // Verify podcast exists
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    // If parentId is provided, verify parent comment exists and belongs to same podcast
    if (parentId) {
      const parentComment = await this.prisma.podcastComment.findUnique({
        where: { id: parentId },
      });

      if (!parentComment || parentComment.podcastId !== podcastId) {
        throw new BadRequestException('Invalid parent comment');
      }
    }

    const comment = await this.prisma.podcastComment.create({
      data: {
        userId,
        podcastId,
        parentId,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update reply count if this is a reply
    if (parentId) {
      await this.prisma.podcastComment.update({
        where: { id: parentId },
        data: {
          replyCount: {
            increment: 1,
          },
        },
      });
    }

    return comment;
  }

  async getCommentsByPodcast(
    podcastId: string,
    page: number = 1,
    limit: number = 20,
    includeReplies: boolean = true,
  ) {
    const skip = (page - 1) * limit;

    const comments = await this.prisma.podcastComment.findMany({
      where: {
        podcastId,
        parentId: null, // Only get top-level comments
        isModerated: false,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        ...(includeReplies && {
          replies: {
            take: 5, // Limit replies to first 5
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        }),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.podcastComment.count({
      where: {
        podcastId,
        parentId: null,
        isModerated: false,
      },
    });

    return {
      data: comments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getReplies(
    parentCommentId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const replies = await this.prisma.podcastComment.findMany({
      where: {
        parentId: parentCommentId,
        isModerated: false,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.podcastComment.count({
      where: {
        parentId: parentCommentId,
        isModerated: false,
      },
    });

    return {
      data: replies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateComment(
    userId: string,
    commentId: string,
    updateCommentDto: UpdatePodcastCommentDto,
  ) {
    const comment = await this.prisma.podcastComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const updatedComment = await this.prisma.podcastComment.update({
      where: { id: commentId },
      data: {
        content: updateCommentDto.content.trim(),
        isEdited: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return updatedComment;
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.podcastComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Delete comment and all its replies
    await this.prisma.podcastComment.deleteMany({
      where: {
        OR: [{ id: commentId }, { parentId: commentId }],
      },
    });

    // Update parent reply count if this was a reply
    if (comment.parentId) {
      await this.prisma.podcastComment.update({
        where: { id: comment.parentId },
        data: {
          replyCount: {
            decrement: 1,
          },
        },
      });
    }

    return { message: 'Comment deleted successfully' };
  }

  async likeComment(userId: string, commentId: string, isLiked: boolean) {
    const comment = await this.prisma.podcastComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // For simplicity, we'll just increment/decrement the like count
    // In a real app, you'd want a separate table to track who liked what
    const likeChange = isLiked ? 1 : -1;

    const updatedComment = await this.prisma.podcastComment.update({
      where: { id: commentId },
      data: {
        likeCount: {
          increment: likeChange,
        },
      },
    });

    return { likeCount: updatedComment.likeCount, isLiked };
  }

  async reportComment(
    userId: string,
    commentId: string,
    reportDto: ReportCommentDto,
  ) {
    void reportDto;
    const comment = await this.prisma.podcastComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.prisma.podcastComment.update({
      where: { id: commentId },
      data: {
        isReported: true,
      },
    });

    // In a real app, you'd create a report record here
    // await this.prisma.commentReport.create({ ... });

    return { message: 'Comment reported successfully' };
  }

  async getUserComments(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const comments = await this.prisma.podcastComment.findMany({
      where: {
        userId,
        isModerated: false,
      },
      include: {
        podcast: {
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.podcastComment.count({
      where: {
        userId,
        isModerated: false,
      },
    });

    return {
      data: comments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
