import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Max, Min } from 'class-validator';

export class AIInsightsDto {
    @ApiProperty({ example: 'Perfect for intermediate learners' })
    @IsString()
    difficultyMatch: string;

    @ApiProperty({ example: 'Matches your interest in business English' })
    @IsString()
    topicRelevance: string;

    @ApiProperty({
        example: 'Helps improve listening comprehension',
    })
    @IsString()
    learningGoalAlignment: string;
}

export class PodcastRecommendationDto {
    @ApiProperty({ example: 'uuid-podcast-id' })
    @IsString()
    podcastId: string;

    @ApiProperty({ type: 'object', description: 'Full podcast object' })
    podcast: any; // Will be populated with Podcast entity

    @ApiProperty({
        example: 'This podcast is recommended because it matches your current level',
    })
    @IsString()
    reason: string;

    @ApiProperty({ example: 85, minimum: 0, maximum: 100 })
    @IsNumber()
    @Min(0)
    @Max(100)
    matchScore: number;

    @ApiProperty({ type: AIInsightsDto })
    aiInsights: AIInsightsDto;
}

export class UserProfileSummaryDto {
    @ApiProperty({ example: 'intermediate' })
    currentLevel: string;

    @ApiProperty({ example: ['business', 'technology'] })
    recentTopics: string[];

    @ApiProperty({ example: ['vocabulary', 'grammar'] })
    strengths: string[];

    @ApiProperty({ example: ['pronunciation', 'listening'] })
    areasToImprove: string[];
}

export class RecommendationResponseDto {
    @ApiProperty({ type: [PodcastRecommendationDto] })
    recommendations: PodcastRecommendationDto[];

    @ApiProperty({ type: UserProfileSummaryDto })
    userProfile: UserProfileSummaryDto;

    @ApiProperty({ example: '2025-11-21T13:20:00Z' })
    generatedAt: Date;
}
