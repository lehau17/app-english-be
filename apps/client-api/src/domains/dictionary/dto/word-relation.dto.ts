import { ApiProperty } from '@nestjs/swagger';

export class WordExamplesDto {
  @ApiProperty({
    description: 'List of example sentences.',
    example: [
      'a ship of the line',
      'the line of succession',
      'a line of communication',
    ],
  })
  examples: string[];
}

export class WordRelationsDto {
  @ApiProperty({
    description: 'List of related words.',
    example: ['motor vehicle', 'wheeled vehicle'],
  })
  relations: string[];
}