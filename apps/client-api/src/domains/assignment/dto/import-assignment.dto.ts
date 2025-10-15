import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

export class ImportAssignmentDto {
    @ApiProperty({ description: 'Assignment title' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ description: 'Assignment description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Assignment instructions' })
    @IsString()
    @IsOptional()
    instructions?: string;

    @ApiPropertyOptional({
        description: 'Due date for assignment',
        example: '2024-12-31T17:00:00Z',
    })
    @IsDateString()
    @IsOptional()
    dueDate?: string;

    @ApiPropertyOptional({
        description: 'Total points possible',
        minimum: 1,
        default: 100,
    })
    @IsInt()
    @Min(1)
    @IsOptional()
    @Transform(({ value }) =>
        typeof value === 'number' ? value : parseInt(value),
    )
    totalPoints?: number = 100;

    @ApiPropertyOptional({ description: 'Time limit in minutes' })
    @IsInt()
    @Min(1)
    @IsOptional()
    @Transform(({ value }) =>
        typeof value === 'number' ? value : parseInt(value),
    )
    timeLimit?: number;

    @ApiPropertyOptional({
        description: 'Maximum attempts allowed',
        minimum: 1,
        default: 1,
    })
    @IsInt()
    @Min(1)
    @IsOptional()
    @Transform(({ value }) =>
        typeof value === 'number' ? value : parseInt(value),
    )
    maxAttempts?: number = 1;

    @ApiPropertyOptional({
        description: 'Publish assignment immediately',
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    isPublished?: boolean = false;

    @ApiPropertyOptional({
        description: 'Assign to specific students (user IDs)',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    assignedTo?: string[] = [];
}

export interface ImportedActivity {
    type: string;
    title: string;
    instructions?: string;
    content: any;
    points?: number;
    timeLimit?: number;
    maxAttempts?: number;
    passingScore?: number;
    difficulty?: string;
    hints?: string[];
}

export interface ImportAssignmentResult {
    assignment: {
        title: string;
        description?: string;
        instructions?: string;
        dueDate?: string;
        totalPoints?: number;
        timeLimit?: number;
        maxAttempts?: number;
        isPublished?: boolean;
        assignedTo?: string[];
    };
    activities: ImportedActivity[];
    errors: string[];
    warnings: string[];
}
