import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class GenerateLearningPathForExistingStudentDto {
  @ApiProperty({
    description: 'Reason for updating the learning path',
    example: 'Student completed current path and needs new challenges',
    minLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  updateReason!: string;
}





