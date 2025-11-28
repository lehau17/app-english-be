import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { Tool } from 'langchain/tools';
import { ChartGeneratorTool } from './chart-generator.tool';

/**
 * ContentStatsTool - Công cụ thống kê nội dung học tập
 *
 * Features:
 * - Thống kê courses, lessons, activities
 * - Phân tích nội dung theo category, level
 * - Xem top nội dung phổ biến
 * - Biểu đồ phân bố nội dung
 */
@Injectable()
export class ContentStatsTool extends Tool {
  name = 'get_content_stats';
  description = `Thống kê nội dung học tập trong hệ thống. Sử dụng khi:
- "thống kê khóa học", "có bao nhiêu bài học"
- "nội dung phổ biến nhất", "top courses"
- "phân bố nội dung theo cấp độ", "activities theo loại"
- "khóa học mới", "content overview"
- "phân tích nội dung", "lesson stats"
INPUT: JSON với action ('overview', 'courses', 'lessons', 'activities', 'popular'), category, level, limit
OUTPUT: Thống kê chi tiết với biểu đồ.`;

  private readonly logger = new Logger(ContentStatsTool.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly chartGenerator: ChartGeneratorTool,
  ) {
    super();
  }

  async _call(input: string): Promise<string> {
    try {
      this.logger.log(`Content Stats Tool called: ${input}`);

      let params: {
        action?: string;
        category?: string;
        level?: string;
        limit?: number;
        period?: string;
      } = {};

      try {
        params = JSON.parse(input);
      } catch {
        params = { action: 'overview' };
      }

      const action = params.action || 'overview';
      const limit = params.limit || 10;

      switch (action) {
        case 'overview':
          return await this.getOverview();
        case 'courses':
          return await this.getCourseStats(params.level, limit);
        case 'lessons':
          return await this.getLessonStats(limit);
        case 'activities':
          return await this.getActivityStats();
        case 'popular':
          return await this.getPopularContent(limit);
        default:
          return await this.getOverview();
      }
    } catch (error) {
      this.logger.error('Content Stats error:', error);
      return JSON.stringify({
        success: false,
        error: 'Lỗi khi thống kê nội dung: ' + (error as Error).message,
      });
    }
  }

  private async getOverview(): Promise<string> {
    const [
      totalCourses,
      publishedCourses,
      totalLessons,
      totalActivities,
      totalVocabularyTerms,
      totalPodcasts,
      totalClassrooms,
      activeClassrooms,
    ] = await Promise.all([
      this.prisma.course.count(),
      this.prisma.course.count({ where: { isPublished: true } }),
      this.prisma.lesson.count(),
      this.prisma.activity.count(),
      this.prisma.vocabularyTerm.count(),
      this.prisma.podcast.count(),
      this.prisma.classroom.count(),
      this.prisma.classroom.count({ where: { status: 'ongoing' } }),
    ]);

    // Activity type breakdown
    const activityByType = await this.prisma.activity.groupBy({
      by: ['type'],
      _count: { id: true },
    });

    // Course by difficulty
    const courseByDifficulty = await this.prisma.course.groupBy({
      by: ['difficulty'],
      _count: { id: true },
    });

    // Generate pie chart for activity types
    const activityChartData = activityByType.map((a) => ({
      label: this.formatActivityType(a.type),
      value: a._count.id,
    }));

    const charts: string[] = [];

    if (activityChartData.length > 0) {
      const activityChart = await this.chartGenerator._call(
        JSON.stringify({
          type: 'pie',
          title: 'Phân bố Activity theo loại',
          data: activityChartData,
        }),
      );
      const chartResult = JSON.parse(activityChart);
      if (chartResult.success) {
        charts.push(chartResult.imageUrl);
      }
    }

    // Generate bar chart for course difficulties
    const difficultyChartData = courseByDifficulty.map((c) => ({
      label: c.difficulty || 'N/A',
      value: c._count.id,
    }));

    if (difficultyChartData.length > 0) {
      const difficultyChart = await this.chartGenerator._call(
        JSON.stringify({
          type: 'bar',
          title: 'Khóa học theo độ khó',
          data: difficultyChartData,
        }),
      );
      const chartResult = JSON.parse(difficultyChart);
      if (chartResult.success) {
        charts.push(chartResult.imageUrl);
      }
    }

    return JSON.stringify({
      success: true,
      action: 'overview',
      stats: {
        courses: {
          total: totalCourses,
          published: publishedCourses,
          draft: totalCourses - publishedCourses,
          byDifficulty: courseByDifficulty.map((c) => ({
            difficulty: c.difficulty || 'N/A',
            count: c._count.id,
          })),
        },
        lessons: totalLessons,
        activities: {
          total: totalActivities,
          byType: activityByType.map((a) => ({
            type: a.type,
            label: this.formatActivityType(a.type),
            count: a._count.id,
          })),
        },
        vocabularyTerms: totalVocabularyTerms,
        podcasts: totalPodcasts,
        classrooms: {
          total: totalClassrooms,
          active: activeClassrooms,
        },
      },
      charts,
      summary: `Hệ thống có ${totalCourses} khóa học (${publishedCourses} đã xuất bản), ${totalLessons} bài học, ${totalActivities} hoạt động, ${totalVocabularyTerms} từ vựng, ${totalPodcasts} podcasts.`,
    });
  }

  private async getCourseStats(
    difficulty?: string,
    limit: number = 10,
  ): Promise<string> {
    const whereClause: any = {};
    if (difficulty) {
      whereClause.difficulty = difficulty;
    }

    const courses = await this.prisma.course.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        difficulty: true,
        isPublished: true,
        createdAt: true,
        enrollmentCount: true,
        _count: {
          select: {
            lessons: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Courses with most lessons
    const topByLessons = await this.prisma.course.findMany({
      select: {
        id: true,
        title: true,
        _count: { select: { lessons: true } },
      },
      orderBy: { lessons: { _count: 'desc' } },
      take: 5,
    });

    return JSON.stringify({
      success: true,
      action: 'courses',
      filterDifficulty: difficulty || 'all',
      count: courses.length,
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        difficulty: c.difficulty,
        isPublished: c.isPublished,
        lessonCount: c._count.lessons,
        enrollmentCount: c.enrollmentCount,
        createdAt: c.createdAt,
      })),
      topByLessons: topByLessons.map((c) => ({
        id: c.id,
        title: c.title,
        lessonCount: c._count.lessons,
      })),
    });
  }

  private async getLessonStats(limit: number = 10): Promise<string> {
    const [totalLessons, lessonsWithActivities] = await Promise.all([
      this.prisma.lesson.count(),
      this.prisma.lesson.count({
        where: { activities: { some: {} } },
      }),
    ]);

    // Lessons with most activities
    const topByActivities = await this.prisma.lesson.findMany({
      select: {
        id: true,
        title: true,
        course: {
          select: { title: true },
        },
        _count: {
          select: { activities: true },
        },
      },
      orderBy: { activities: { _count: 'desc' } },
      take: limit,
    });

    // Recent lessons
    const recentLessons = await this.prisma.lesson.findMany({
      select: {
        id: true,
        title: true,
        createdAt: true,
        course: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return JSON.stringify({
      success: true,
      action: 'lessons',
      stats: {
        total: totalLessons,
        withActivities: lessonsWithActivities,
        percentWithActivities:
          totalLessons > 0
            ? Math.round((lessonsWithActivities / totalLessons) * 100)
            : 0,
      },
      topByActivities: topByActivities.map((l) => ({
        id: l.id,
        title: l.title,
        courseName: l.course?.title || 'N/A',
        activityCount: l._count.activities,
      })),
      recentLessons: recentLessons.map((l) => ({
        id: l.id,
        title: l.title,
        courseName: l.course?.title || 'N/A',
        createdAt: l.createdAt,
      })),
    });
  }

  private async getActivityStats(): Promise<string> {
    const totalActivities = await this.prisma.activity.count();

    // By type
    const byType = await this.prisma.activity.groupBy({
      by: ['type'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Activities with most attempts
    const mostAttempted = await this.prisma.activity.findMany({
      select: {
        id: true,
        type: true,
        title: true,
        lessonId: true,
        _count: {
          select: { attempts: true },
        },
      },
      orderBy: { attempts: { _count: 'desc' } },
      take: 10,
    });

    // Generate chart
    const chartData = byType.map((a) => ({
      label: this.formatActivityType(a.type),
      value: a._count.id,
    }));

    let chartUrl = '';
    if (chartData.length > 0) {
      const chartResult = await this.chartGenerator._call(
        JSON.stringify({
          type: 'pie',
          title: 'Phân bố hoạt động theo loại',
          data: chartData,
        }),
      );
      const parsed = JSON.parse(chartResult);
      if (parsed.success) {
        chartUrl = parsed.imageUrl;
      }
    }

    return JSON.stringify({
      success: true,
      action: 'activities',
      stats: {
        total: totalActivities,
        byType: byType.map((a) => ({
          type: a.type,
          label: this.formatActivityType(a.type),
          count: a._count.id,
          percentage:
            totalActivities > 0
              ? Math.round((a._count.id / totalActivities) * 100)
              : 0,
        })),
      },
      mostAttempted: mostAttempted.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        attemptCount: a._count.attempts,
      })),
      charts: chartUrl ? [chartUrl] : [],
    });
  }

  private async getPopularContent(limit: number = 10): Promise<string> {
    // Most enrolled courses (using enrollmentCount field)
    const popularCourses = await this.prisma.course.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        difficulty: true,
        enrollmentCount: true,
      },
      orderBy: { enrollmentCount: 'desc' },
      take: limit,
    });

    // Most viewed podcasts (using viewCount)
    const popularPodcasts = await this.prisma.podcast.findMany({
      select: {
        id: true,
        title: true,
        viewCount: true,
        category: true,
      },
      orderBy: { viewCount: 'desc' },
      take: limit,
    });

    // Most practiced vocabulary terms
    const popularVocab = await this.prisma.vocabularyTerm.findMany({
      select: {
        id: true,
        word: true,
        unitId: true,
        _count: {
          select: { userProgress: true },
        },
      },
      orderBy: { userProgress: { _count: 'desc' } },
      take: limit,
    });

    // Generate chart for popular courses
    const courseChartData = popularCourses.slice(0, 5).map((c) => ({
      label: c.title.substring(0, 20) + (c.title.length > 20 ? '...' : ''),
      value: c.enrollmentCount,
    }));

    let chartUrl = '';
    if (courseChartData.length > 0) {
      const chartResult = await this.chartGenerator._call(
        JSON.stringify({
          type: 'bar',
          title: 'Top 5 khóa học phổ biến',
          data: courseChartData,
        }),
      );
      const parsed = JSON.parse(chartResult);
      if (parsed.success) {
        chartUrl = parsed.imageUrl;
      }
    }

    return JSON.stringify({
      success: true,
      action: 'popular',
      popularCourses: popularCourses.map((c, i) => ({
        rank: i + 1,
        id: c.id,
        title: c.title,
        difficulty: c.difficulty,
        enrollments: c.enrollmentCount,
      })),
      popularPodcasts: popularPodcasts.map((p, i) => ({
        rank: i + 1,
        id: p.id,
        title: p.title,
        category: p.category,
        views: p.viewCount,
      })),
      popularVocabulary: popularVocab.map((v, i) => ({
        rank: i + 1,
        id: v.id,
        word: v.word,
        learnerCount: v._count.userProgress,
      })),
      charts: chartUrl ? [chartUrl] : [],
    });
  }

  private formatActivityType(type: string): string {
    const typeMap: Record<string, string> = {
      vocab: 'Từ vựng',
      pronunciation: 'Phát âm',
      listening: 'Nghe',
      speaking: 'Nói',
      mini_game: 'Mini Game',
      fill_blank: 'Điền từ',
      dictation: 'Chính tả',
      matching: 'Ghép cặp',
      reading: 'Đọc',
      writing: 'Viết',
      grammar: 'Ngữ pháp',
      quiz: 'Trắc nghiệm',
      flashcard: 'Flashcard',
      conversation: 'Hội thoại',
    };
    return typeMap[type] || type;
  }
}
