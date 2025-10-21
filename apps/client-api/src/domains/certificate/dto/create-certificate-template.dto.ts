import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CertificateRequirementType } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCertificateTemplateDto {
    @ApiProperty({ description: 'Course ID' })
    @IsString()
    courseId: string;

    @ApiPropertyOptional({ description: 'Certificate title', default: 'Certificate of Completion' })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiPropertyOptional({ description: 'Certificate description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Template layout JSON' })
    @IsOptional()
    layout?: any;

    @ApiPropertyOptional({ description: 'Issuer name', default: 'English Learning Platform' })
    @IsString()
    @IsOptional()
    issuerName?: string;

    @ApiPropertyOptional({ description: 'Issuer title', default: 'Director of Education' })
    @IsString()
    @IsOptional()
    issuerTitle?: string;

    @ApiPropertyOptional({ description: 'Issuer signature URL' })
    @IsString()
    @IsOptional()
    issuerSignature?: string;

    @ApiPropertyOptional({ description: 'Logo URL' })
    @IsString()
    @IsOptional()
    logoUrl?: string;

    @ApiPropertyOptional({
        description: 'Requirement type',
        enum: CertificateRequirementType,
        default: CertificateRequirementType.course_completion
    })
    @IsEnum(CertificateRequirementType)
    @IsOptional()
    requirementType?: CertificateRequirementType;

    @ApiPropertyOptional({ description: 'Minimum score required (0-100)' })
    @IsNumber()
    @Min(0)
    @Max(100)
    @IsOptional()
    minScore?: number;

    @ApiPropertyOptional({ description: 'Minimum progress percentage (0-100)', default: 100 })
    @IsNumber()
    @Min(0)
    @Max(100)
    @IsOptional()
    minProgress?: number;

    @ApiPropertyOptional({ description: 'Is template active', default: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

