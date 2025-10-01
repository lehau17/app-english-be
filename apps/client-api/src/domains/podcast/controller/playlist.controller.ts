import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  AddToPlaylistDto,
  RemoveFromPlaylistDto,
} from '../dto/playlist-item.dto';
import {
  CreatePlaylistDto,
  GetPlaylistsQueryDto,
  UpdatePlaylistDto,
} from '../dto/playlist.dto';
import { PlaylistEntity } from '../entities/playlist.entity';
import { PlaylistService } from '../service/playlist.service';

@ApiTags('Playlists')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/playlists')
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Get()
  @ApiOperation({ summary: 'Get user playlists' })
  @ResponseMessage('Playlists retrieved successfully')
  async getUserPlaylists(
    @PayloadToken() payload: JwtPayload,
    @Query() query: GetPlaylistsQueryDto,
  ): Promise<PageResponseDto<PlaylistEntity>> {
    return this.playlistService.getUserPlaylists(payload.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get playlist by ID' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ResponseMessage('Playlist retrieved successfully')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.playlistService.findOne(id, payload.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new playlist' })
  @ResponseMessage('Playlist created successfully')
  async create(
    @Body() createPlaylistDto: CreatePlaylistDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.playlistService.create(createPlaylistDto, payload.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ResponseMessage('Playlist updated successfully')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlaylistDto: UpdatePlaylistDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.playlistService.update(id, updatePlaylistDto, payload.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ResponseMessage('Playlist deleted successfully')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.playlistService.remove(id, payload.sub);
  }

  // ===================== PLAYLIST ITEMS ENDPOINTS =====================

  @Post(':id/items')
  @ApiOperation({ summary: 'Add podcast to playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ResponseMessage('Podcast added to playlist successfully')
  async addPodcast(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addToPlaylistDto: AddToPlaylistDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.playlistService.addPodcast(id, addToPlaylistDto, payload.sub);
  }

  @Delete(':id/items/:podcastId')
  @ApiOperation({ summary: 'Remove podcast from playlist' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ApiParam({ name: 'podcastId', description: 'Podcast ID' })
  @ResponseMessage('Podcast removed from playlist successfully')
  async removePodcast(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('podcastId', ParseUUIDPipe) podcastId: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    const removeFromPlaylistDto: RemoveFromPlaylistDto = { podcastId };
    return this.playlistService.removePodcast(
      id,
      removeFromPlaylistDto,
      payload.sub,
    );
  }

  @Get(':id/items')
  @ApiOperation({ summary: 'Get playlist items' })
  @ApiParam({ name: 'id', description: 'Playlist ID' })
  @ResponseMessage('Playlist items retrieved successfully')
  async getPlaylistItems(
    @Param('id', ParseUUIDPipe) id: string,
    @PayloadToken() payload: JwtPayload,
  ): Promise<any> {
    return this.playlistService.getPlaylistItems(id, payload.sub);
  }
}
