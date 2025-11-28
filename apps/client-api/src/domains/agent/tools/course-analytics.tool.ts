import { PrismaRepository } from '@app/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { Tool } from 'langchain/tools';

@Injectable()
export class CourseAnalyticsTool extends Tool {
  name = 'analyze_course';
  description = `Phân tích chi tiết khóa học với AI insights và tạo nhiều biểu đồ.

TRIGGER: Sử dụng khi admin muốn:
- "phân tích khóa học [tên]"
- "so sánh các khóa học"
- "khóa nào hiệu quả nhất"
- "thống kê enrollment"
- "báo cáo khóa học"

INPUT: JSON với các trường:
- courseId (optional): ID khóa học cụ thể
- courseName (optional): Tên khóa học để tìm
- compareAll (optional): true để so sánh tất cả khóa học

OUTPUT: Trả về:
- Thống kê enrollment, completion rate, điểm TB
- 3-4 biểu đồ trực quan
- AI insights và đề xuất cải thiện`;

  private readonly logger = new Logger(CourseAnalyticsTool.name);
  private genAI: GoogleGenerativeAI;

  constructor(private prisma: PrismaRepository) {
    super();
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async _call(input: string): Promise<string> {
    try {
      this.logger.log(`Course Analytics Tool called with: ${input}`);

      let params: { courseId?: string; courseName?: string; compareAll?: boolean } = {};
      try {
        params = JSON.parse(input);
      } catch {
        params = { compareAll: true };
      }

      // Get course data
      const courseData = await this.getCourseData(params);

      if (!courseData || courseData.courses.length === 0) {
        return JSON.stringify({
          success: false,
          message: 'Không tìm thấy khóa học nào.',
        });
      }

      // Generate AI insights
      const aiInsights = await this.analyzeWithAI(courseData);

      // Generate charts
      const charts = this.generateCharts(courseData);

      return JSON.stringify({
        success: true,
        summary: {
          totalCourses: courseData.courses.length,
          totalEnrollments: courseData.totalEnrollments,
          avgCompletionRate: courseData.avgCompletionRate,
          avgScore: courseData.avgScore,
        },
        courses: courseData.courses.map((c) => ({
          id: c.id,
          title: c.title,
          difficulty: c.difficulty,
          enrollments: c.enrollments,
          completionRate: c.completionRate,
          avgScore: c.avgScore,
        })),
        aiInsights,
        charts,
      });
    } catch (error) {
      this.logger.error('Course Analytics error:', error);
      return JSON.stringify({
        success: false,
        error: 'Lỗi khi phân tích khóa học: ' + (error as Error).message,
      });
    }
  }

  private async getCourseData(params: { courseId?: string; courseName?: string; compareAll?: boolean }) {
    const where: any = { isPublished: true };

    if (params.courseId) {
      where.id = params.courseId;
    } else if (params.courseName) {
      where.title = { contains: params.courseName, mode: 'insensitive' };
    }

    const courses = await this.prisma.course.findMany({
      where,
      include: {
        classrooms: {
          include: {
            students: true,
          },
        },
        lessons: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const courseStats = await Promise.all(
      courses.map(async (course) => {
        const enrollments = course.classrooms.reduce((sum, c) => sum + c.students.length, 0);

        // Get submissions for this course via classrooms
        const classroomIds = course.classrooms.map((c) => c.id);
        const submissions = await this.prisma.assignmentSubmission.findMany({
          where: {
            assignment: {
              classroom: { id: { in: classroomIds } },
            },
          },
        });

        const totalSubmissions = submissions.length;
        const completedSubmissions = submissions.filter((s) => s.status === 'submitted').length;
        const totalScore = submissions.reduce((sum, s) => sum + (s.score || 0), 0);
        const avgScore = totalSubmissions > 0 ? Math.round(totalScore / totalSubmissions) : 0;
        const completionRate = totalSubmissions > 0 ? Math.round((completedSubmissions / totalSubmissions) * 100) : 0;

        return {
          id: course.id,
          title: course.title,
          difficulty: course.difficulty || 'N/A',
          totalLessons: course.lessons.length,
          enrollments,
          completionRate,
          avgScore,
          createdAt: course.createdAt,
        };
      }),
    );

    const totalEnrollments = courseStats.reduce((sum, c) => sum + c.enrollments, 0);
    const avgCompletionRate =
      courseStats.length > 0
        ? Math.round(courseStats.reduce((sum, c) => sum + c.completionRate, 0) / courseStats.length)
        : 0;
    const avgScore =
      courseStats.length > 0
        ? Math.round(courseStats.reduce((sum, c) => sum + c.avgScore, 0) / courseStats.length)
        : 0;

    return {
      courses: courseStats,
      totalEnrollments,
      avgCompletionRate,
      avgScore,
    };
  }

  private async analyzeWithAI(data: any): Promise<any> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `Phân tích dữ liệu khóa học sau và đưa ra insights:

${JSON.stringify(data, null, 2)}

Trả về JSON với format:
{
  "summary": "Tóm tắt ngắn gọn về tình hình các khóa học",
  "topPerformers": ["Khóa học có hiệu suất tốt nhất"],
  "needsImprovement": ["Khóa học cần cải thiện"],
  "recommendations": ["Đề xuất cụ thể"],
  "marketingTips": ["Gợi ý marketing cho khóa ít học viên"]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { summary: text };
    } catch (error) {
      this.logger.error('AI analysis error:', error);
      return { summary: 'Không thể phân tích AI lúc này.' };
    }
  }

  private generateCharts(data: any): any[] {
    const charts: any[] = [];
    const courses = data.courses;

    // Chart 1: Bar - Enrollment comparison
    charts.push({
      type: 'chart',
      chartType: 'bar',
      title: 'So sánh Enrollment các khóa học',
      data: courses.slice(0, 10).map((c: any) => ({
        name: c.title.substring(0, 20),
        'Học viên': c.enrollments,
        'Bài học': c.totalLessons,
      })),
      config: {
        xAxisKey: 'name',
        bars: [
          { dataKey: 'Học viên', color: '#3B82F6' },
          { dataKey: 'Bài học', color: '#10B981' },
        ],
      },
    });

    // Chart 2: Pie - Difficulty distribution
    const difficultyCounts: Record<string, number> = {};
    courses.forEach((c: any) => {
      const level = c.difficulty || 'Chưa phân loại';
      difficultyCounts[level] = (difficultyCounts[level] || 0) + 1;
    });
    charts.push({
      type: 'chart',
      chartType: 'pie',
      title: 'Phân bố độ khó khóa học',
      data: Object.entries(difficultyCounts).map(([name, value]) => ({ name, value })),
      config: {
        colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
      },
    });

    // Chart 3: Radar - Course metrics comparison (top 5)
    const top5 = courses.slice(0, 5);
    if (top5.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'radar',
        title: 'So sánh metrics Top 5 khóa học',
        data: [
          {
            metric: 'Enrollment',
            ...Object.fromEntries(top5.map((c: any) => [c.title.substring(0, 15), c.enrollments])),
          },
          {
            metric: 'Completion %',
            ...Object.fromEntries(top5.map((c: any) => [c.title.substring(0, 15), c.completionRate])),
          },
          {
            metric: 'Điểm TB',
            ...Object.fromEntries(top5.map((c: any) => [c.title.substring(0, 15), c.avgScore])),
          },
          {
            metric: 'Bài học',
            ...Object.fromEntries(top5.map((c: any) => [c.title.substring(0, 15), c.totalLessons * 10])),
          },
        ],
        config: {
          radars: top5.map((c: any, i: number) => ({
            dataKey: c.title.substring(0, 15),
            color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i],
          })),
        },
      });
    }

    // Chart 4: Bar - Score vs Completion
    charts.push({
      type: 'chart',
      chartType: 'bar',
      title: '🔗 Điểm TB và Completion Rate',
      data: courses.slice(0, 8).map((c: any) => ({
        name: c.title.substring(0, 15),
        'Điểm TB': c.avgScore,
        'Completion %': c.completionRate,
      })),
      config: {
        xAxisKey: 'name',
        bars: [
          { dataKey: 'Điểm TB', color: '#8B5CF6' },
          { dataKey: 'Completion %', color: '#EC4899' },
        ],
      },
    });

    return charts;
  }
}
