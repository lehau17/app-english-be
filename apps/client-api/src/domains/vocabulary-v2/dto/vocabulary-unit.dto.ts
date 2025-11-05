import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsInt,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';
import { VocabularyTermResponseDto } from './vocabulary-term.dto';

export class CreateVocabularyUnitDto {
    @ApiProperty({
        description: 'Unit title',
        example: 'Unit 1: Travel & Tourism',
    })
    @IsString()
    @MinLength(3)
    @MaxLength(200)
    title: string;

    @ApiPropertyOptional({
        description: 'Unit description',
        example: 'Essential vocabulary for travel and tourism topics',
    })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiPropertyOptional({
        description: 'Order index in list',
        minimum: 0,
        default: 0,
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    orderIndex?: number;
}

export class UpdateVocabularyUnitDto {
    @ApiPropertyOptional({ description: 'Unit title' })
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(200)
    title?: string;

    @ApiPropertyOptional({ description: 'Unit description' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiPropertyOptional({ description: 'Order index' })
    @IsOptional()
    @IsInt()
    @Min(0)
    orderIndex?: number;
}

export class VocabularyUnitResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    listId: string;

    @ApiProperty()
    title: string;

    @ApiPropertyOptional()
    description?: string;

    @ApiProperty()
    orderIndex: number;

    @ApiProperty()
    termCount: number;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    // Optional: include terms if requested
    @ApiPropertyOptional({ type: [VocabularyTermResponseDto] })
    terms?: VocabularyTermResponseDto[];

    // User progress (if authenticated)
    @ApiPropertyOptional({
        description: 'User progress for this unit',
    })
    userProgress?: {
        completedTerms: number;
        totalTerms: number;
    };
}

export class ReorderUnitsDto {
    @ApiProperty({
        description: 'Ordered array of unit IDs',
        example: ['unit-id-1', 'unit-id-2', 'unit-id-3'],
        type: [String],
    })
    @IsString({ each: true })
    unitIds: string[];
}


