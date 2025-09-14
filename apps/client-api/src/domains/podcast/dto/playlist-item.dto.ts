import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class AddToPlaylistDto {
  @ApiProperty({ description: 'Podcast ID to add to playlist' })
  @IsString()
  @IsUUID()
  podcastId: string;
}

export class RemoveFromPlaylistDto {
  @ApiProperty({ description: 'Podcast ID to remove from playlist' })
  @IsString()
  @IsUUID()
  podcastId: string;
}
