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

    // TODO: Implement when playlist models are added to database
  return PageResponseDto.of([], page, limit, 0);
  }

  async findOne(id: string, userId: string) {
    // TODO: Implement when playlist models are added to database
    throw new NotFoundException('Playlist not found');
  }

  async create(createPlaylistDto: CreatePlaylistDto, userId: string) {
    // TODO: Implement when playlist models are added to database
    throw new BadRequestException('Playlist functionality not yet implemented');
  }

  async update(id: string, updatePlaylistDto: UpdatePlaylistDto, userId: string) {
    // TODO: Implement when playlist models are added to database
    throw new NotFoundException('Playlist not found or access denied');
  }

  async remove(id: string, userId: string) {
    // TODO: Implement when playlist models are added to database
    throw new NotFoundException('Playlist not found or access denied');
  }

  // ===================== PLAYLIST ITEMS MANAGEMENT =====================

  async addPodcast(playlistId: string, addToPlaylistDto: AddToPlaylistDto, userId: string) {
    // TODO: Implement when playlist models are added to database
    throw new NotFoundException('Playlist not found or access denied');
  }

  async removePodcast(playlistId: string, removeFromPlaylistDto: RemoveFromPlaylistDto, userId: string) {
    // TODO: Implement when playlist models are added to database
    throw new NotFoundException('Playlist not found or access denied');
  }

  async getPlaylistItems(playlistId: string, userId: string) {
    // TODO: Implement when playlist models are added to database
    throw new NotFoundException('Playlist not found or access denied');
  }
}
