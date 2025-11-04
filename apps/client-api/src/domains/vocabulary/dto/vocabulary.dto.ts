import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class SaveWordDto {
  @ApiProperty({
    description: 'The word to save to the vocabulary book.',
    example: 'ephemeral',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  word: string;
}
