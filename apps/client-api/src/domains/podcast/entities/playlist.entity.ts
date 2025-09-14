import { ApiProperty } from '@nestjs/swagger';

export class PlaylistEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  description?: string;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<PlaylistEntity>) {
    Object.assign(this, partial);
  }

  static fromPrisma(prismaPlaylist: any): PlaylistEntity {
    return new PlaylistEntity({
      id: prismaPlaylist.id,
      name: prismaPlaylist.name,
      description: prismaPlaylist.description,
      isPublic: prismaPlaylist.isPublic,
      userId: prismaPlaylist.userId,
      createdAt: prismaPlaylist.createdAt,
      updatedAt: prismaPlaylist.updatedAt,
    });
  }
}
