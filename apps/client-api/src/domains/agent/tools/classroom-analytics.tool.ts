import { PrismaRepository } from '@app/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ClassroomAnalyticsTool {
  private readonly logger = new Logger(ClassroomAnalyticsTool.name);
  private genAI: GoogleGenerativeAI;

  constructor(private prisma: PrismaRepository) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'analyze_classroom',
      description: `Phan tich chi tiet lop hoc voi AI insights va tao nhieu bieu do.

TRIGGER: Su dung khi admin muon:
- "phan tich lop hoc [ten]"
- "so sanh cac lop"
- "lop nao can can thiep"
- "thong ke lop hoc"
- "attendance report"

OUTPUT: Tra ve:
- Thong ke hoc vien, attendance, diem TB
- 3-4 bieu do truc quan
- AI insights va canh bao lop can can thiep`,
      schema: z.object({
        classroomId: z.string().optional().describe('ID lop hoc cu the'),
        classroomName: z.string().optional().describe('Ten lop de tim'),
        teacherId: z.string().optional().describe('ID giao vien de loc lop'),
        compareAll: z
          .boolean()
          .optional()
          .default(true)
          .describe('So sanh tat ca lop'),
      }),
      func: async ({
        classroomId,
        classroomName,
        teacherId,
        compareAll = true,
      }) => {
        return this._call(
          JSON.stringify({ classroomId, classroomName, teacherId, compareAll }),
        );
      },
    });
  }

  private async _call(input: string): Promise<string> {
    try {
      this.logger.log(`🏫 Classroom Analytics Tool called with: ${input}`);

      let params: {
        classroomId?: string;
        classroomName?: string;
        teacherId?: string;
        compareAll?: boolean;
      } = {};
      try {
        params = JSON.parse(input);
      } catch {
        params = { compareAll: true };
      }

      // Get classroom data
      const classroomData = await this.getClassroomData(params);

      if (!classroomData || classroomData.classrooms.length === 0) {
        return JSON.stringify({
          success: false,
          message: 'Không tìm thấy lớp học nào.',
        });
      }

      // Generate AI insights
      const aiInsights = await this.analyzeWithAI(classroomData);

      // Generate charts
      const charts = this.generateCharts(classroomData);

      return JSON.stringify({
        success: true,
        summary: {
          totalClassrooms: classroomData.classrooms.length,
          totalStudents: classroomData.totalStudents,
          avgAttendance: classroomData.avgAttendance,
          avgScore: classroomData.avgScore,
        },
        classrooms: classroomData.classrooms.map((c) => ({
          id: c.id,
          name: c.name,
          teacher: c.teacherName,
          students: c.studentCount,
          avgScore: c.avgScore,
          completionRate: c.completionRate,
        })),
        aiInsights,
        charts,
      });
    } catch (error) {
      this.logger.error('Classroom Analytics error:', error);
      return JSON.stringify({
        success: false,
        error: 'Lỗi khi phân tích lớp học: ' + (error as Error).message,
      });
    }
  }

  private async getClassroomData(params: {
    classroomId?: string;
    classroomName?: string;
    teacherId?: string;
    compareAll?: boolean;
  }) {
    const where: any = {};

    if (params.classroomId) {
      where.id = params.classroomId;
    } else if (params.classroomName) {
      where.name = { contains: params.classroomName, mode: 'insensitive' };
    }
    if (params.teacherId) {
      where.teacherId = params.teacherId;
    }

    const classrooms = await this.prisma.classroom.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        students: {
          include: {
            student: true,
          },
        },
        course: {
          select: { id: true, title: true },
        },
        sessions: {
          take: 10,
          orderBy: { startTime: 'desc' },
          include: {
            attendance: true,
          },
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const classroomStats = await Promise.all(
      classrooms.map(async (classroom) => {
        const studentIds = classroom.students.map((s) => s.studentId);

        // Get assignment submissions for this classroom's students
        const submissions = await this.prisma.assignmentSubmission.findMany({
          where: {
            studentId: { in: studentIds },
            assignment: { classroomId: classroom.id },
          },
        });

        const totalScore = submissions.reduce(
          (sum, s) => sum + (s.score || 0),
          0,
        );
        const avgScore =
          submissions.length > 0
            ? Math.round(totalScore / submissions.length)
            : 0;
        const completedCount = submissions.filter(
          (s) => s.status === 'submitted',
        ).length;
        const completionRate =
          submissions.length > 0
            ? Math.round((completedCount / submissions.length) * 100)
            : 0;

        // Calculate attendance
        const totalAttendances = classroom.sessions.reduce(
          (sum, s) => sum + s.attendance.length,
          0,
        );
        const presentAttendances = classroom.sessions.reduce(
          (sum, s) =>
            sum + s.attendance.filter((a) => a.status === 'present').length,
          0,
        );
        const attendanceRate =
          totalAttendances > 0
            ? Math.round((presentAttendances / totalAttendances) * 100)
            : 0;

        return {
          id: classroom.id,
          name: classroom.name,
          teacherName:
            classroom.teacher?.displayName ||
            `${classroom.teacher?.firstName || ''} ${classroom.teacher?.lastName || ''}`.trim() ||
            'N/A',
          courseName: classroom.course?.title || 'N/A',
          studentCount: classroom.students.length,
          avgScore,
          completionRate,
          attendanceRate,
          totalSessions: classroom.sessions.length,
        };
      }),
    );

    const totalStudents = classroomStats.reduce(
      (sum, c) => sum + c.studentCount,
      0,
    );
    const avgAttendance =
      classroomStats.length > 0
        ? Math.round(
            classroomStats.reduce((sum, c) => sum + c.attendanceRate, 0) /
              classroomStats.length,
          )
        : 0;
    const avgScore =
      classroomStats.length > 0
        ? Math.round(
            classroomStats.reduce((sum, c) => sum + c.avgScore, 0) /
              classroomStats.length,
          )
        : 0;

    return {
      classrooms: classroomStats,
      totalStudents,
      avgAttendance,
      avgScore,
    };
  }

  private async analyzeWithAI(data: any): Promise<any> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const prompt = `Phân tích dữ liệu lớp học sau và đưa ra insights:

${JSON.stringify(data, null, 2)}

Trả về JSON với format:
{
  "summary": "Tóm tắt ngắn gọn về tình hình các lớp học",
  "topPerformers": ["Lớp có hiệu suất tốt nhất"],
  "needsIntervention": ["Lớp cần can thiệp ngay (attendance thấp, điểm kém)"],
  "recommendations": ["Đề xuất cải thiện cụ thể"],
  "alerts": ["Cảnh báo quan trọng"]
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
    const classrooms = data.classrooms;

    // Chart 1: Bar - Student count comparison
    charts.push({
      type: 'chart',
      chartType: 'bar',
      title: '👥 So sánh số học viên các lớp',
      data: classrooms.slice(0, 10).map((c: any) => ({
        name: c.name.substring(0, 15),
        'Học viên': c.studentCount,
        'Buổi học': c.totalSessions,
      })),
      config: {
        xAxisKey: 'name',
        bars: [
          { dataKey: 'Học viên', color: '#3B82F6' },
          { dataKey: 'Buổi học', color: '#10B981' },
        ],
      },
    });

    // Chart 2: Radar - Class metrics comparison (top 5)
    const top5 = classrooms.slice(0, 5);
    if (top5.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'radar',
        title: 'So sánh metrics Top 5 lớp học',
        data: [
          {
            metric: 'Học viên',
            ...Object.fromEntries(
              top5.map((c: any) => [
                c.name.substring(0, 12),
                c.studentCount * 5,
              ]),
            ),
          },
          {
            metric: 'Điểm TB',
            ...Object.fromEntries(
              top5.map((c: any) => [c.name.substring(0, 12), c.avgScore]),
            ),
          },
          {
            metric: 'Attendance',
            ...Object.fromEntries(
              top5.map((c: any) => [c.name.substring(0, 12), c.attendanceRate]),
            ),
          },
          {
            metric: 'Completion',
            ...Object.fromEntries(
              top5.map((c: any) => [c.name.substring(0, 12), c.completionRate]),
            ),
          },
        ],
        config: {
          radars: top5.map((c: any, i: number) => ({
            dataKey: c.name.substring(0, 12),
            color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i],
          })),
        },
      });
    }

    // Chart 3: Pie - Completion rate distribution
    const completionBuckets = {
      'Xuất sắc (>80%)': 0,
      'Tốt (60-80%)': 0,
      'Trung bình (40-60%)': 0,
      'Cần cải thiện (<40%)': 0,
    };
    classrooms.forEach((c: any) => {
      if (c.completionRate > 80) completionBuckets['Xuất sắc (>80%)']++;
      else if (c.completionRate > 60) completionBuckets['Tốt (60-80%)']++;
      else if (c.completionRate > 40)
        completionBuckets['Trung bình (40-60%)']++;
      else completionBuckets['Cần cải thiện (<40%)']++;
    });
    charts.push({
      type: 'chart',
      chartType: 'pie',
      title: 'Phân bố Completion Rate các lớp',
      data: Object.entries(completionBuckets)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value })),
      config: {
        colors: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
      },
    });

    // Chart 4: Bar - Score and Attendance comparison
    charts.push({
      type: 'chart',
      chartType: 'bar',
      title: 'Điểm TB và Attendance theo lớp',
      data: classrooms.slice(0, 8).map((c: any) => ({
        name: c.name.substring(0, 12),
        'Điểm TB': c.avgScore,
        'Attendance %': c.attendanceRate,
      })),
      config: {
        xAxisKey: 'name',
        bars: [
          { dataKey: 'Điểm TB', color: '#8B5CF6' },
          { dataKey: 'Attendance %', color: '#EC4899' },
        ],
      },
    });

    return charts;
  }
}
