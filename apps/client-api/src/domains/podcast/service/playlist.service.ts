import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AddToPlaylistDto, RemoveFromPlaylistDto } from '../dto/playlist-item.dto';
import {
  CreatePlaylistDto,
  GetPlaylistsQueryDto,
  UpdatePlaylistDto,
} from '../dto/playlist.dto';

@Injectable()
export class PlaylistService {
  constructor(private readonly prisma: PrismaRepository) {}

  // ===================== PLAYLIST CRUD =====================

  async getUserPlaylists(userId: string, query: GetPlaylistsQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'newest',
      sortOrder = 'desc',
      privacy,
    } = query;

    const skip = (page - 1) * limit;

    // Build where conditions
    const where: any = {
      userId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Handle privacy filter
    if (privacy === 'public') {
      where.isPublic = true;
    } else if (privacy === 'private') {
      where.isPublic = false;
    }

    // Build orderBy
    const orderBy: any = {};
    if (sortBy === 'newest') {
      orderBy.createdAt = sortOrder;
    } else if (sortBy === 'oldest') {
      orderBy.createdAt = sortOrder === 'desc' ? 'asc' : 'desc';
    } else if (sortBy === 'name') {
      orderBy.name = sortOrder;
    } else if (sortBy === 'updated') {
      orderBy.updatedAt = sortOrder;
    }

    const [playlists, total] = await Promise.all([
      this.prisma.playlist.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          playlistPodcasts: {
            select: { podcastId: true },
          },
          _count: {
            select: { playlistPodcasts: true },
          },
        },
      }),
      this.prisma.playlist.count({ where }),
    ]);

    const playlistsWithCounts = playlists.map(playlist => ({
      ...playlist,
      podcastCount: playlist.podcastCount || playlist._count?.playlistPodcasts || 0,
      playlistPodcasts: undefined,
      _count: undefined,
    }));

    return PageResponseDto.of(playlistsWithCounts, page, limit, total);
  }

  async findOne(id: string, userId: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { isPublic: true },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        playlistPodcasts: {
          include: {
            podcast: {
              select: {
                id: true,
                title: true,
                description: true,
                audioUrl: true,
                duration: true,
                difficulty: true,
                thumbnailUrl: true,
                createdAt: true,
              },
            },
          },
          orderBy: { orderNo: 'asc' },
        },
        _count: {
          select: { playlistPodcasts: true },
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    return {
      ...playlist,
      podcastCount: playlist.podcastCount || playlist._count?.playlistPodcasts || 0,
      podcasts: playlist.playlistPodcasts?.map(pp => ({
        ...pp.podcast,
        orderNo: pp.orderNo,
        addedAt: pp.addedAt,
      })) || [],
      playlistPodcasts: undefined,
      _count: undefined,
    };
  }

  async create(createPlaylistDto: CreatePlaylistDto, userId: string) {
    const { name, description, isPublic = false, thumbnailUrl, tags = [], category } = createPlaylistDto;

    // Check if user already has a playlist with this name
    const existingPlaylist = await this.prisma.playlist.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (existingPlaylist) {
      throw new BadRequestException('You already have a playlist with this name');
    }

    const playlist = await this.prisma.playlist.create({
      data: {
        name,
        description,
        isPublic,
        userId,
        podcastCount: 0,
        thumbnailUrl,
        tags,
        category,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { playlistPodcasts: true },
        },
      },
    });

    return {
      ...playlist,
      podcastCount: 0,
      _count: undefined,
    };
  }

  async update(id: string, updatePlaylistDto: UpdatePlaylistDto, userId: string) {
    const { name, description, isPublic, thumbnailUrl, tags, category } = updatePlaylistDto;

    // Check if playlist exists and user owns it
    const existingPlaylist = await this.prisma.playlist.findFirst({
      where: { id, userId },
    });

    if (!existingPlaylist) {
      throw new NotFoundException('Playlist not found or access denied');
    }

    // If updating name, check for duplicates
    if (name && name !== existingPlaylist.name) {
      const duplicatePlaylist = await this.prisma.playlist.findFirst({
        where: {
          userId,
          name: { equals: name, mode: 'insensitive' },
          NOT: { id },
        },
      });

      if (duplicatePlaylist) {
        throw new BadRequestException('You already have a playlist with this name');
      }
    }

    const playlist = await this.prisma.playlist.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(tags !== undefined && { tags }),
        ...(category !== undefined && { category }),
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { playlistPodcasts: true },
        },
      },
    });

    return {
      ...playlist,
      podcastCount: playlist.podcastCount || playlist._count?.playlistPodcasts || 0,
      _count: undefined,
    };
  }

  async remove(id: string, userId: string) {
    // Check if playlist exists and user owns it
    const existingPlaylist = await this.prisma.playlist.findFirst({
      where: { id, userId },
    });

    if (!existingPlaylist) {
      throw new NotFoundException('Playlist not found or access denied');
    }

    // Delete the playlist (cascade will handle PlaylistPodcast relationships)
    await this.prisma.playlist.delete({
      where: { id },
    });

    return { message: 'Playlist deleted successfully' };
  }

  // ===================== PLAYLIST ITEMS MANAGEMENT =====================

  async addPodcast(id: string, addToPlaylistDto: AddToPlaylistDto, userId: string) {
    const { podcastId } = addToPlaylistDto;

    // Check if playlist exists and user owns it
    const playlist = await this.prisma.playlist.findFirst({
      where: { id, userId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found or access denied');
    }

    // Check if podcast exists
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    // Check if podcast is already in playlist
    const existingEntry = await this.prisma.playlistPodcast.findUnique({
      where: {
        playlistId_podcastId: {
          playlistId: id,
          podcastId,
        },
      },
    });

    if (existingEntry) {
      throw new BadRequestException('Podcast is already in this playlist');
    }

    // Get the next order number
    const lastEntry = await this.prisma.playlistPodcast.findFirst({
      where: { playlistId: id },
      orderBy: { orderNo: 'desc' },
    });

    const orderNo = (lastEntry?.orderNo || 0) + 1;

    // Add podcast to playlist
    await this.prisma.playlistPodcast.create({
      data: {
        playlistId: id,
        podcastId,
        orderNo,
      },
    });

    // Update playlist podcast count
    await this.prisma.playlist.update({
      where: { id },
      data: {
        podcastCount: {
          increment: 1,
        },
      },
    });

    return { message: 'Podcast added to playlist successfully' };
  }

  async removePodcast(playlistId: string, removeFromPlaylistDto: RemoveFromPlaylistDto, userId: string) {
    const { podcastId } = removeFromPlaylistDto;

    // Check if playlist exists and user owns it
    const playlist = await this.prisma.playlist.findFirst({
      where: { id: playlistId, userId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found or access denied');
    }

    // Check if podcast is in playlist
    const playlistPodcast = await this.prisma.playlistPodcast.findUnique({
      where: {
        playlistId_podcastId: {
          playlistId,
          podcastId,
        },
      },
    });

    if (!playlistPodcast) {
      throw new NotFoundException('Podcast not found in this playlist');
    }

    // Remove podcast from playlist
    await this.prisma.playlistPodcast.delete({
      where: {
        playlistId_podcastId: {
          playlistId,
          podcastId,
        },
      },
    });

    // Update playlist podcast count
    await this.prisma.playlist.update({
      where: { id: playlistId },
      data: {
        podcastCount: {
          decrement: 1,
        },
      },
    });

    // Reorder remaining podcasts to fill gap
    const remainingPodcasts = await this.prisma.playlistPodcast.findMany({
      where: {
        playlistId,
        orderNo: { gt: playlistPodcast.orderNo },
      },
      orderBy: { orderNo: 'asc' },
    });

    // Update order numbers for remaining podcasts
    for (let i = 0; i < remainingPodcasts.length; i++) {
      await this.prisma.playlistPodcast.update({
        where: {
          playlistId_podcastId: {
            playlistId: remainingPodcasts[i].playlistId,
            podcastId: remainingPodcasts[i].podcastId,
          },
        },
        data: {
          orderNo: playlistPodcast.orderNo + i,
        },
      });
    }

    return { message: 'Podcast removed from playlist successfully' };
  }

  async getPlaylistItems(playlistId: string, userId: string) {
    // Check if playlist exists and user has access (owner or public)
    const playlist = await this.prisma.playlist.findFirst({
      where: {
        id: playlistId,
        OR: [
          { userId }, // Owner can access
          { isPublic: true }, // Anyone can access public playlists
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found or access denied');
    }

    // Get playlist items with podcast details
    const playlistItems = await this.prisma.playlistPodcast.findMany({
      where: { playlistId },
      include: {
        podcast: {
          include: {
            author: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { orderNo: 'asc' },
    });

    return {
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        isPublic: playlist.isPublic,
        podcastCount: playlist.podcastCount,
        user: playlist.user,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
      },
      items: playlistItems.map(item => ({
        orderNo: item.orderNo,
        addedAt: item.addedAt,
        podcast: item.podcast,
      })),
    };
  }
}
