import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Course, DifficultyLevel } from '@prisma/client';
import { StudentAnalyticsTool } from '../../agent/tools/student-analytics.tool';
import { GenerateLearningPathForNewStudentDto } from '../dto/generate-learning-path-for-new-student.dto';
import { LearningPathService } from './learning-path.service';

interface SkillBreakdown {
  grammar: number;
  vocabulary: number;
  listening: number;
  speaking: number;
  reading: number;
  writing: number;
}

interface StudentProfile {
  currentLevel: DifficultyLevel;
  weakAreas: string[];
  goals: {
    targetLevel: DifficultyLevel;
    focusAreas: string[];
    timeframe?: number;
  };
  progress: {
    totalLessons: number;
    completedLessons: number;
    averageScore: number;
  };
  skillBreakdown: SkillBreakdown;
}

interface SuggestedPath {
  name: string;
  targetLevel: DifficultyLevel;
  focusAreas: string[];
  courseIds: string[];
  reasoning: string;
}

@Injectable()
export class LearningPathGenerationService {
  private readonly logger = new Logger(LearningPathGenerationService.name);

  constructor(
    private readonly learningPathService: LearningPathService,
    private readonly prisma: PrismaRepository,
    private readonly geminiService: GeminiService,
    private readonly analyticsTool: StudentAnalyticsTool,
  ) {}

  /**
   * Generate learning path for new student
   */
  async generateForNewStudent(
    userId: string,
    goals?: GenerateLearningPathForNewStudentDto,
  ): Promise<string> {
    this.logger.log(`Generating learning path for new student: ${userId}`);

    try {
      // 1. Analyze student profile
      const profile = await this.analyzeStudentProfile(userId);

      // 2. Merge with provided goals
      const mergedGoals = {
        targetLevel: goals?.targetLevel || profile.currentLevel,
        focusAreas: goals?.focusAreas || profile.weakAreas,
        timeframe: goals?.timeframe,
      };

      // 3. Get available courses
      const availableCourses = await this.getAvailableCourses(
        profile.currentLevel,
        mergedGoals.focusAreas,
      );

      if (availableCourses.length === 0) {
        this.logger.warn('No courses available for path generation');
        throw new Error('No courses available for path generation');
      }

      // 4. Use AI to suggest optimal path
      const suggestedPath = await this.suggestOptimalPath(
        profile,
        availableCourses,
        mergedGoals,
      );

      // 5. Create learning path
      const path = await this.learningPathService.create(userId, {
        name: suggestedPath.name,
        targetLevel: suggestedPath.targetLevel,
        focusAreas: suggestedPath.focusAreas,
        courseIds: suggestedPath.courseIds,
        timeframe: mergedGoals.timeframe,
      });

      this.logger.log(`Learning path created: ${path.id}`);
      return path.id;
    } catch (error) {
      this.logger.error(`Error generating path for new student: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate learning path for existing student
   */
  async generateForExistingStudent(
    userId: string,
    updateReason: string,
  ): Promise<string> {
    this.logger.log(`Generating learning path for existing student: ${userId}, reason: ${updateReason}`);

    // Check if already has active path
    const activePath = await this.learningPathService.findActiveByUserId(userId);
    if (activePath) {
      // Update existing path
      return this.updatePath(userId, activePath.id, updateReason);
    }

    // Generate new path
    return this.generateForNewStudent(userId);
  }

  /**
   * Update existing learning path
   */
  async updatePath(
    userId: string,
    pathId: string,
    reason: string,
  ): Promise<string> {
    this.logger.log(`Updating learning path: ${pathId}, reason: ${reason}`);

    // Analyze current profile
    const profile = await this.analyzeStudentProfile(userId);

    // Get available courses
    const availableCourses = await this.getAvailableCourses(
      profile.currentLevel,
      profile.weakAreas,
    );

    // Suggest updated path
    const suggestedPath = await this.suggestOptimalPath(
      profile,
      availableCourses,
      {
        targetLevel: profile.goals.targetLevel,
        focusAreas: profile.goals.focusAreas,
      },
    );

    // Update path
    await this.learningPathService.update(pathId, userId, {
      name: suggestedPath.name,
      targetLevel: suggestedPath.targetLevel,
      focusAreas: suggestedPath.focusAreas,
      courseIds: suggestedPath.courseIds,
    });

    return pathId;
  }

  /**
   * Analyze student profile
   */
  private async analyzeStudentProfile(userId: string): Promise<StudentProfile> {
    // Get student data using analytics tool
    const studentData = await this.analyticsTool.getStudentData(userId, 'all');

    // Determine current level based on average score
    let currentLevel: DifficultyLevel = DifficultyLevel.beginner;
    if (studentData.averageScore >= 80) {
      currentLevel = DifficultyLevel.advanced;
    } else if (studentData.averageScore >= 60) {
      currentLevel = DifficultyLevel.intermediate;
    }

    // Identify weak areas (skills < 60)
    const weakAreas: string[] = [];
    const defaultSkillBreakdown: SkillBreakdown = {
      grammar: 0,
      vocabulary: 0,
      listening: 0,
      speaking: 0,
      reading: 0,
      writing: 0,
    };
    const rawSkillBreakdown = studentData.skillBreakdown;
    const skillBreakdown: SkillBreakdown = rawSkillBreakdown &&
      typeof rawSkillBreakdown === 'object' &&
      'grammar' in rawSkillBreakdown &&
      'vocabulary' in rawSkillBreakdown &&
      'listening' in rawSkillBreakdown &&
      'speaking' in rawSkillBreakdown &&
      'reading' in rawSkillBreakdown &&
      'writing' in rawSkillBreakdown
      ? (rawSkillBreakdown as SkillBreakdown)
      : defaultSkillBreakdown;
    if (skillBreakdown.grammar < 60) weakAreas.push('grammar');
    if (skillBreakdown.vocabulary < 60) weakAreas.push('vocabulary');
    if (skillBreakdown.listening < 60) weakAreas.push('listening');
    if (skillBreakdown.speaking < 60) weakAreas.push('speaking');
    if (skillBreakdown.reading < 60) weakAreas.push('reading');
    if (skillBreakdown.writing < 60) weakAreas.push('writing');

    // If no weak areas, use lowest skill
    if (weakAreas.length === 0) {
      const skills = [
        { name: 'grammar', score: skillBreakdown.grammar || 0 },
        { name: 'vocabulary', score: skillBreakdown.vocabulary || 0 },
        { name: 'listening', score: skillBreakdown.listening || 0 },
        { name: 'speaking', score: skillBreakdown.speaking || 0 },
        { name: 'reading', score: skillBreakdown.reading || 0 },
        { name: 'writing', score: skillBreakdown.writing || 0 },
      ];
      const lowestSkill = skills.reduce((min, skill) =>
        skill.score < min.score ? skill : min,
      );
      weakAreas.push(lowestSkill.name);
    }

    return {
      currentLevel,
      weakAreas,
      goals: {
        targetLevel: currentLevel === DifficultyLevel.beginner
          ? DifficultyLevel.intermediate
          : DifficultyLevel.advanced,
        focusAreas: weakAreas,
      },
      progress: {
        totalLessons: studentData.totalAssignments || 0,
        completedLessons: studentData.completedAssignments || 0,
        averageScore: studentData.averageScore || 0,
      },
      skillBreakdown: skillBreakdown,
    };
  }

  /**
   * Get available courses matching level and focus areas
   */
  private async getAvailableCourses(
    level: DifficultyLevel,
    focusAreas: string[],
  ): Promise<Course[]> {
    // Get published courses matching level
    const courses = await this.prisma.course.findMany({
      where: {
        difficulty: level,
        isPublished: true,
      },
      include: {
        lessons: {
          include: {
            activities: {
              select: {
                type: true,
              },
            },
          },
        },
      },
      take: 50, // Limit to avoid too many courses
    });

    // Analyze course focus and filter by focus areas
    const coursesWithFocus = courses.map((course) => {
      const activities = course.lessons.flatMap((l) => l.activities);
      const total = activities.length;
      if (total === 0) return { course, matchScore: 0 };

      // Count activities by type
      const activityCounts = {
        grammar: 0,
        vocabulary: 0,
        listening: 0,
        speaking: 0,
        reading: 0,
        writing: 0,
      };

      activities.forEach((activity) => {
        const type = activity.type?.toLowerCase() || '';
        if (type.includes('grammar')) activityCounts.grammar++;
        else if (type.includes('vocab')) activityCounts.vocabulary++;
        else if (type.includes('listen')) activityCounts.listening++;
        else if (type.includes('speak')) activityCounts.speaking++;
        else if (type.includes('read')) activityCounts.reading++;
        else if (type.includes('write')) activityCounts.writing++;
      });

      // Calculate match score based on focus areas
      let matchScore = 0;
      focusAreas.forEach((area) => {
        const count = activityCounts[area as keyof typeof activityCounts] || 0;
        const percentage = (count / total) * 100;
        matchScore += percentage;
      });

      return { course, matchScore: matchScore / focusAreas.length };
    });

    // Sort by match score and return top courses
    coursesWithFocus.sort((a, b) => b.matchScore - a.matchScore);
    return coursesWithFocus
      .filter((c) => c.matchScore > 10) // At least 10% match
      .slice(0, 10) // Top 10 courses
      .map((c) => c.course);
  }

  /**
   * Use AI to suggest optimal learning path
   */
  private async suggestOptimalPath(
    profile: StudentProfile,
    availableCourses: Course[],
    goals: {
      targetLevel: DifficultyLevel;
      focusAreas: string[];
      timeframe?: number;
    },
  ): Promise<SuggestedPath> {
    const prompt = `Bạn là chuyên gia giáo dục tiếng Anh. Hãy đề xuất lộ trình học tối ưu cho học sinh.

**Thông tin học sinh:**
- Trình độ hiện tại: ${profile.currentLevel}
- Điểm yếu: ${profile.weakAreas.join(', ')}
- Mục tiêu: ${goals.targetLevel}
- Kỹ năng cần tập trung: ${goals.focusAreas.join(', ')}
- Điểm trung bình: ${profile.progress.averageScore}%
- Tỷ lệ hoàn thành: ${Math.round((profile.progress.completedLessons / profile.progress.totalLessons) * 100)}%

**Danh sách khóa học có sẵn:**
${availableCourses.map((c, i) => `${i + 1}. ${c.title} (ID: ${c.id}) - ${c.difficulty} - ${c.description?.substring(0, 100)}...`).join('\n')}

**Yêu cầu:**
1. Chọn 3-5 khóa học phù hợp nhất (theo thứ tự ưu tiên)
2. Đặt tên cho lộ trình học (ví dụ: "Lộ trình từ ${profile.currentLevel} đến ${goals.targetLevel}")
3. Giải thích lý do chọn các khóa học này

**Trả về JSON format:**
{
  "name": "Tên lộ trình",
  "targetLevel": "${goals.targetLevel}",
  "focusAreas": ["skill1", "skill2"],
  "courseIds": ["course-id-1", "course-id-2", ...],
  "reasoning": "Lý do chọn lộ trình này"
}`;

    try {
      const response = await this.geminiService.generateJSONResponse(prompt);
      const parsed = JSON.parse(response);

      // Validate response
      if (!parsed.courseIds || !Array.isArray(parsed.courseIds)) {
        throw new Error('Invalid AI response: missing courseIds');
      }

      // Validate course IDs exist
      const validCourseIds = parsed.courseIds.filter((id: string) =>
        availableCourses.some((c) => c.id === id),
      );

      if (validCourseIds.length === 0) {
        // Fallback: use top 3 courses by match
        return {
          name: `Lộ trình từ ${profile.currentLevel} đến ${goals.targetLevel}`,
          targetLevel: goals.targetLevel,
          focusAreas: goals.focusAreas,
          courseIds: availableCourses.slice(0, 3).map((c) => c.id),
          reasoning: 'Lộ trình được tạo tự động dựa trên trình độ và điểm yếu của học sinh',
        };
      }

      return {
        name: parsed.name || `Lộ trình từ ${profile.currentLevel} đến ${goals.targetLevel}`,
        targetLevel: parsed.targetLevel || goals.targetLevel,
        focusAreas: parsed.focusAreas || goals.focusAreas,
        courseIds: validCourseIds.slice(0, 5), // Max 5 courses
        reasoning: parsed.reasoning || 'Lộ trình được đề xuất bởi AI',
      };
    } catch (error) {
      this.logger.warn(`AI path suggestion failed, using fallback: ${error.message}`);
      // Fallback: use top courses
      return {
        name: `Lộ trình từ ${profile.currentLevel} đến ${goals.targetLevel}`,
        targetLevel: goals.targetLevel,
        focusAreas: goals.focusAreas,
        courseIds: availableCourses.slice(0, 3).map((c) => c.id),
        reasoning: 'Lộ trình được tạo tự động dựa trên trình độ và điểm yếu của học sinh',
      };
    }
  }
}

