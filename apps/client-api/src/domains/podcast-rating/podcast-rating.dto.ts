import { RequestPagingDto } from '@app/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePodcastRatingDto {
  @ApiProperty({ description: 'Podcast id' })
  @IsString()
  podcastId: string;

  @ApiProperty({ description: 'Overall rating (1-5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating: number;

  @ApiProperty({ description: 'Difficulty rating (1-5)', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficultyRating?: number;

  @ApiProperty({ description: 'Quality rating (1-5)', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  qualityRating?: number;
}

export class UpdatePodcastRatingDto {
  @ApiProperty({ description: 'Overall rating (1-5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating: number;

  @ApiProperty({ description: 'Difficulty rating (1-5)', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficultyRating?: number;

  @ApiProperty({ description: 'Quality rating (1-5)', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  qualityRating?: number;
}

export class PodcastRatingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  podcastId: string;

  @ApiProperty()
  overallRating: number;

  @ApiProperty({ required: false })
  difficultyRating?: number;

  @ApiProperty({ required: false })
  qualityRating?: number;

  @ApiProperty()
  createdAt: Date;
}



export class FilterPodcastQueryDto extends RequestPagingDto {

}
