import { Injectable, Logger } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { RagTool } from './rag.tool';
import { SqlTool } from './sql.tool';
import { ChartGeneratorTool } from './chart-generator.tool';
import { RagService } from '../service/rag.service';
import { SqlService } from '../service/sql.service';
import { PrismaRepository } from '@app/database';

@Injectable()
export class StudentAgentTools {
  private readonly logger = new Logger(StudentAgentTools.name);

  constructor(
    private ragService: RagService,
    private sqlService: SqlService,
    private prisma: PrismaRepository,
    private chartTool: ChartGeneratorTool,
  ) {}

  getTools() {
    return [
      new RagTool(this.ragService),
      new SqlTool(this.sqlService),
      this.chartTool,
      this.getScoreReportTool(),
    ];
  }

  private getScoreReportTool() {
    return new DynamicStructuredTool({
      name: 'get_score_report',
      description: 'Tạo báo cáo điểm số của học sinh với biểu đồ. Sử dụng khi học sinh hỏi về điểm số, thành tích, báo cáo học tập.',
      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
        limit: z.number().optional().default(10).describe('Số lượng bài tập'),
      }),
      func: async ({ userId, limit = 10 }) => {
        try {
          this.logger.log('Score report for user: ' + userId);

          const submissions = await this.prisma.assignmentSubmission.findMany({
            where: { studentId: userId, score: { not: null } },
            include: { assignment: { select: { title: true, totalPoints: true } } },
            orderBy: { submittedAt: 'desc' },
            take: limit,
          });

          if (submissions.length === 0) {
            return JSON.stringify({ success: false, message: 'Chưa có bài được chấm điểm!' });
          }

          const scores = submissions.map(s => s.score);
          const totalPoints = submissions.map(s => s.assignment.totalPoints);
          const percentages = submissions.map((s, idx) => (s.score / totalPoints[idx]) * 100);
          const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          const avgPercentage = percentages.reduce((a, b) => a + b, 0) / percentages.length;

          const chartData = submissions.reverse().map((s, idx) => {
            const num = submissions.length - idx;
            return 'Bài ' + num + ': ' + s.score + '/' + s.assignment.totalPoints;
          });

          const chartPrompt = 'Biểu đồ cột điểm số ' + submissions.length + ' bài tập. Dữ liệu: ' + chartData.join(', ');
          const chartResult = await this.chartTool._call(chartPrompt);

          return JSON.stringify({
            success: true,
            summary: {
              total: submissions.length,
              avg: avgScore.toFixed(1),
              avgPct: avgPercentage.toFixed(1) + '%',
              max: Math.max(...scores),
              min: Math.min(...scores),
            },
            chart: chartResult,
            insights: this.generateInsights(avgPercentage, percentages),
          });
        } catch (error) {
          this.logger.error('Score report error:', error);
          return JSON.stringify({ success: false, error: 'Lỗi tạo báo cáo' });
        }
      },
    });
  }

  private generateInsights(avgPct: number, pcts: number[]): string[] {
    const insights = [];
    if (avgPct >= 80) insights.push('Xuất sắc!');
    else if (avgPct >= 70) insights.push('Tốt!');
    else if (avgPct >= 50) insights.push('Cố gắng hơn!');
    else insights.push('Ôn tập nhiều hơn!');

    if (pcts.length >= 3) {
      const r3 = pcts.slice(-3).reduce((a,b)=>a+b,0)/3;
      const o3 = pcts.slice(0,3).reduce((a,b)=>a+b,0)/3;
      if (r3 > o3 + 10) insights.push('Điểm đang tăng!');
      else if (r3 < o3 - 10) insights.push('Cần cải thiện!');
    }
    return insights;
  }
}
