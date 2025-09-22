import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AddToPlaylistDto,
  RemoveFromPlaylistDto,
} from '../dto/playlist-item.dto';
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
      search: _search,
      sortBy: _sortBy = 'newest',
      sortOrder: _sortOrder = 'desc',
      privacy: _privacy,
    } = query;

    // TODO: Implement when playlist models are added to database
    return PageResponseDto.of([], page, limit, 0);
  }

  async findOne(_id: string, _userId: string) {
    // TODO: Implement when playlist models are added to database
    throw new NotFoundException('Playlist not found');
  }

  async create(_createPlaylistDto: CreatePlaylistDto, _userId: string) {
    // TODO: Implement when playlist models are added to database
    throw new BadRequestException('Playlist functionality not yet implemented');
  }

  async update(
    _id: string,
    _updatePlaylistDto: UpdatePlaylistDto,
    _userId: string,
  ) {
    // TODO: Implement when playlist models are added to database
    throw new NotFoundException('Playlist not found or access denied');
  }

  async remove(_id: string, _userId: string) {
    // TODO: Implement when playlist models are added to database
    throw new NotFoundException('Playlist not found or access denied');
  }

  // ===================== PLAYLIST ITEMS MANAGEMENT =====================

  async addPodcast(
    _playlistId: string,
    _addToPlaylistDto: AddToPlaylistDto,
    _userId: string,
  ) {
    // TODO: Implement when playlist models are added to database
    throw new NotFoundException('Playlist not found or access denied');
  }

  async removePodcast(
    _playlistId: string,
    _removeFromPlaylistDto: RemoveFromPlaylistDto,
    _userId: string,
  ) {
    // TODO: Implement when playlist models are added to database
    throw new NotFoundException('Playlist not found or access denied');
  }

  async getPlaylistItems(_playlistId: string, _userId: string) {
    // TODO: Implement when playlist models are added to database
    throw new NotFoundException('Playlist not found or access denied');
  }
}
