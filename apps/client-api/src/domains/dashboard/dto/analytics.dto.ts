import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum AnalyticsPeriod {
    LAST_7_DAYS = 'last_7_days',
    LAST_30_DAYS = 'last_30_days',
    LAST_90_DAYS = 'last_90_days',
    ALL_TIME = 'all_time',
}

export class GetStudentAnalyticsDto {
    @ApiProperty({ example: 'uuid-of-student' })
    @IsUUID()
    studentId: string;

    @ApiPropertyOptional({ enum: AnalyticsPeriod, default: AnalyticsPeriod.LAST_30_DAYS })
    @IsOptional()
    @IsEnum(AnalyticsPeriod)
    period?: AnalyticsPeriod;
}

export class GetClassAnalyticsDto {
    @ApiProperty({ example: 'uuid-of-classroom' })
    @IsUUID()
    classroomId: string;

    @ApiPropertyOptional({ enum: AnalyticsPeriod, default: AnalyticsPeriod.LAST_30_DAYS })
    @IsOptional()
    @IsEnum(AnalyticsPeriod)
    period?: AnalyticsPeriod;
}

export class AnalyticsInsight {
    @ApiProperty({ example: 'Điểm mạnh' })
    category: string;

    @ApiProperty({ example: 'Học viên hoàn thành tốt các bài tập về Grammar' })
    insight: string;

    @ApiProperty({ example: 'positive' })
    sentiment: 'positive' | 'neutral' | 'negative';
}

export class AnalyticsRecommendation {
    @ApiProperty({ example: 'Luyện tập thêm Listening' })
    title: string;

    @ApiProperty({ example: 'Nên dành 15-20 phút mỗi ngày để luyện nghe' })
    description: string;

    @ApiProperty({ example: 'high' })
    priority: 'high' | 'medium' | 'low';
}

export class StudentAnalyticsResponse {
    @ApiProperty()
    studentId: string;

    @ApiProperty()
    studentName: string;

    @ApiProperty({ example: 30 })
    totalActivitiesCompleted: number;

    @ApiProperty({ example: 85.5 })
    averageScore: number;

    @ApiProperty({ example: 75.0 })
    completionRate: number;

    @ApiProperty({ example: 1200 })
    totalTimeSpentMinutes: number;

    @ApiProperty({ type: [AnalyticsInsight] })
    insights: AnalyticsInsight[];

    @ApiProperty({ type: [AnalyticsRecommendation] })
    recommendations: AnalyticsRecommendation[];

    @ApiProperty({ example: 'Học viên đang có sự tiến bộ tốt...' })
    aiSummary: string;

    @ApiProperty()
    generatedAt: Date;
}

export class StrugglingStudent {
    @ApiProperty()
    studentId: string;

    @ApiProperty()
    studentName: string;

    @ApiProperty({ example: 55.0 })
    averageScore: number;

    @ApiProperty({ example: 'Gặp khó khăn với Listening' })
    issue: string;
}

export class ClassAnalyticsResponse {
    @ApiProperty()
    classroomId: string;

    @ApiProperty()
    classroomName: string;

    @ApiProperty({ example: 25 })
    totalStudents: number;

    @ApiProperty({ example: 82.3 })
    classAverageScore: number;

    @ApiProperty({ example: 78.5 })
    classCompletionRate: number;

    @ApiProperty({ type: [StrugglingStudent] })
    strugglingStudents: StrugglingStudent[];

    @ApiProperty({ type: [AnalyticsInsight] })
    insights: AnalyticsInsight[];

    @ApiProperty({ type: [AnalyticsRecommendation] })
    recommendations: AnalyticsRecommendation[];

    @ApiProperty({ example: 'Lớp học đang tiến bộ tốt...' })
    aiSummary: string;

    @ApiProperty()
    generatedAt: Date;
}
