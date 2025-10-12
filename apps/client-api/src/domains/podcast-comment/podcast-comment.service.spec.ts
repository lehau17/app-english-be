import { Test, TestingModule } from '@nestjs/testing';
import { PodcastCommentService } from './podcast-comment.service';
import { PrismaRepository } from '@app/database';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePodcastCommentDto } from './podcast-comment.dto';

const mockPrismaRepository = {
  podcast: {
    findUnique: jest.fn(),
  },
  podcastComment: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('PodcastCommentService', () => {
  let service: PodcastCommentService;
  let prisma: typeof mockPrismaRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PodcastCommentService,
        {
          provide: PrismaRepository,
          useValue: mockPrismaRepository,
        },
      ],
    }).compile();

    service = module.get<PodcastCommentService>(PodcastCommentService);
    prisma = module.get<typeof mockPrismaRepository>(PrismaRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createComment', () => {
    const userId = 'user-1';
    const podcastId = 'podcast-1';
    const createCommentDto: CreatePodcastCommentDto = {
      podcastId,
      content: 'This is a comment',
      parentId: null,
    };
    const user = {
      id: userId,
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: 'url',
    };
    const podcast = { id: podcastId };
    const comment = {
      ...createCommentDto,
      id: 'comment-1',
      userId,
      user,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a top-level comment successfully', async () => {
        prisma.podcast.findUnique.mockResolvedValue(podcast);
        prisma.podcastComment.create.mockResolvedValue(comment);

        const result = await service.createComment(userId, createCommentDto);

        expect(prisma.podcast.findUnique).toHaveBeenCalledWith({ where: { id: podcastId } });
        expect(prisma.podcastComment.create).toHaveBeenCalledWith({
            data: {
                userId,
                podcastId,
                parentId: null,
                content: 'This is a comment',
            },
            include: expect.any(Object),
        });
        expect(result).toEqual(comment);
    });

    it('should create a reply comment successfully', async () => {
        const parentId = 'parent-comment-1';
        const createReplyDto: CreatePodcastCommentDto = { ...createCommentDto, parentId };
        const parentComment = { id: parentId, podcastId };
        const replyComment = { ...comment, id: 'reply-1', parentId };

        prisma.podcast.findUnique.mockResolvedValue(podcast);
        prisma.podcastComment.findUnique.mockResolvedValue(parentComment);
        prisma.podcastComment.create.mockResolvedValue(replyComment);
        prisma.podcastComment.update.mockResolvedValue({} as any);

        const result = await service.createComment(userId, createReplyDto);

        expect(prisma.podcastComment.findUnique).toHaveBeenCalledWith({ where: { id: parentId } });
        expect(prisma.podcastComment.create).toHaveBeenCalledWith({
            data: {
                userId,
                podcastId,
                parentId,
                content: 'This is a comment',
            },
            include: expect.any(Object),
        });
        expect(prisma.podcastComment.update).toHaveBeenCalledWith({
            where: { id: parentId },
            data: { replyCount: { increment: 1 } },
        });
        expect(result).toEqual(replyComment);
    });

    it('should throw NotFoundException if podcast not found', async () => {
        prisma.podcast.findUnique.mockResolvedValue(null);

        await expect(service.createComment(userId, createCommentDto)).rejects.toThrow(
            new NotFoundException('Podcast not found'),
        );
    });

    it('should throw BadRequestException if parent comment is invalid', async () => {
        const parentId = 'invalid-parent-id';
        const createReplyDto: CreatePodcastCommentDto = { ...createCommentDto, parentId };

        prisma.podcast.findUnique.mockResolvedValue(podcast);
        prisma.podcastComment.findUnique.mockResolvedValue(null);

        await expect(service.createComment(userId, createReplyDto)).rejects.toThrow(
            new BadRequestException('Invalid parent comment'),
        );
    });
  });

  describe('deleteComment', () => {
    const userId = 'user-1';
    const commentId = 'comment-1';
    const comment = { id: commentId, userId, parentId: null };

    it('should delete a comment successfully', async () => {
        prisma.podcastComment.findUnique.mockResolvedValue(comment as any);
        prisma.podcastComment.deleteMany.mockResolvedValue({ count: 1 } as any);

        const result = await service.deleteComment(userId, commentId);

        expect(prisma.podcastComment.findUnique).toHaveBeenCalledWith({ where: { id: commentId } });
        expect(prisma.podcastComment.deleteMany).toHaveBeenCalledWith({
            where: { OR: [{ id: commentId }, { parentId: commentId }] },
        });
        expect(result).toEqual({ message: 'Comment deleted successfully' });
    });

    it('should throw NotFoundException if comment not found', async () => {
        prisma.podcastComment.findUnique.mockResolvedValue(null);

        await expect(service.deleteComment(userId, commentId)).rejects.toThrow(
            new NotFoundException('Comment not found'),
        );
    });

    it('should throw ForbiddenException if user tries to delete another user\\\'s comment', async () => {
        const anotherUserComment = { ...comment, userId: 'user-2' };
        prisma.podcastComment.findUnique.mockResolvedValue(anotherUserComment as any);

        await expect(service.deleteComment(userId, commentId)).rejects.toThrow(
            new ForbiddenException('You can only delete your own comments'),
        );
    });
  });

  describe('getCommentsByPodcast', () => {
    const podcastId = 'podcast-1';
    const comments = [{ id: 'comment-1' }, { id: 'comment-2' }];
    const total = 2;

    it('should return paginated comments', async () => {
        prisma.podcastComment.findMany.mockResolvedValue(comments as any);
        prisma.podcastComment.count.mockResolvedValue(total);

        const result = await service.getCommentsByPodcast(podcastId, 1, 10);

        expect(prisma.podcastComment.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { podcastId, parentId: null, isModerated: false },
            skip: 0,
            take: 10
        }));
        expect(prisma.podcastComment.count).toHaveBeenCalledWith({
            where: { podcastId, parentId: null, isModerated: false }
        });
        expect(result).toEqual({
            data: comments,
            total,
            page: 1,
            limit: 10,
            totalPages: 1,
        });
    });
  });

  describe('updateComment', () => {
    const userId = 'user-1';
    const commentId = 'comment-1';
    const updateCommentDto = { content: 'updated content' };
    const comment = { id: commentId, userId, content: 'original content' };
    const updatedComment = { ...comment, content: 'updated content', isEdited: true };

    it('should update a comment successfully', async () => {
        prisma.podcastComment.findUnique.mockResolvedValue(comment as any);
        prisma.podcastComment.update.mockResolvedValue(updatedComment as any);

        const result = await service.updateComment(userId, commentId, updateCommentDto);

        expect(prisma.podcastComment.findUnique).toHaveBeenCalledWith({ where: { id: commentId } });
        expect(prisma.podcastComment.update).toHaveBeenCalledWith({
            where: { id: commentId },
            data: { content: 'updated content'.trim(), isEdited: true },
            include: expect.any(Object),
        });
        expect(result).toEqual(updatedComment);
    });

    it('should throw NotFoundException if comment not found', async () => {
        prisma.podcastComment.findUnique.mockResolvedValue(null);

        await expect(service.updateComment(userId, commentId, updateCommentDto)).rejects.toThrow(
            new NotFoundException('Comment not found'),
        );
    });

    it('should throw ForbiddenException if user tries to update another user\\\'s comment', async () => {
        const anotherUserComment = { ...comment, userId: 'user-2' };
        prisma.podcastComment.findUnique.mockResolvedValue(anotherUserComment as any);

        await expect(service.updateComment(userId, commentId, updateCommentDto)).rejects.toThrow(
            new ForbiddenException('You can only edit your own comments'),
        );
    });
  });
});