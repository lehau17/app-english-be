import { PrismaRepository } from '@app/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class RevenueAnalyticsTool {
  private readonly logger = new Logger(RevenueAnalyticsTool.name);
  private genAI: GoogleGenerativeAI;

  constructor(private prisma: PrismaRepository) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'analyze_revenue',
      description: `Phan tich doanh thu va tai chinh voi AI insights va tao nhieu bieu do.

TRIGGER: Su dung khi admin muon:
- "phan tich doanh thu"
- "bao cao tai chinh"
- "hoc phi thang nay"
- "doanh thu theo khoa hoc"
- "doanh thu theo quy"
- "doanh thu theo nam"
- "so sanh doanh thu cac nam"
- "tang truong YoY"
- "thong ke thanh toan"
- "transaction report"

OUTPUT: Tra ve:
- Tong doanh thu, doanh thu theo thang/quy/nam
- So sanh tang truong Year-over-Year (YoY)
- Ty le thanh toan (completed/pending/failed)
- Doanh thu theo khoa hoc
- 6-7 bieu do truc quan
- AI insights va du bao`,
      schema: z.object({
        startDate: z.string().optional().describe('Ngay bat dau (ISO string)'),
        endDate: z.string().optional().describe('Ngay ket thuc (ISO string)'),
        courseId: z.string().optional().describe('ID khoa hoc cu the'),
        period: z
          .enum(['month', 'quarter', 'year'])
          .optional()
          .default('year')
          .describe('Khoang thoi gian'),
      }),
      func: async ({ startDate, endDate, courseId, period = 'year' }) => {
        return this._call(
          JSON.stringify({ startDate, endDate, courseId, period }),
        );
      },
    });
  }

  private async _call(input: string): Promise<string> {
    try {
      this.logger.log(`💰 Revenue Analytics Tool called with: ${input}`);

      let params: {
        startDate?: string;
        endDate?: string;
        courseId?: string;
        period?: string;
      } = {};
      try {
        params = JSON.parse(input);
      } catch {
        params = { period: 'year' };
      }

      // Get revenue data
      const revenueData = await this.getRevenueData(params);

      // Generate AI insights
      const aiInsights = await this.analyzeWithAI(revenueData);

      // Generate charts
      const charts = this.generateCharts(revenueData);

      return JSON.stringify({
        success: true,
        summary: {
          totalRevenue: revenueData.totalRevenue,
          completedAmount: revenueData.completedAmount,
          pendingAmount: revenueData.pendingAmount,
          failedAmount: revenueData.failedAmount,
          successRate: revenueData.successRate,
        },
        monthlyRevenue: revenueData.monthlyRevenue,
        quarterlyRevenue: revenueData.quarterlyRevenue,
        yearlyRevenue: revenueData.yearlyRevenue,
        yoyComparison: revenueData.yoyComparison,
        courseRevenue: revenueData.courseRevenue,
        aiInsights,
        charts,
      });
    } catch (error) {
      this.logger.error('Revenue Analytics error:', error);
      return JSON.stringify({
        success: false,
        error: 'Lỗi khi phân tích doanh thu: ' + (error as Error).message,
      });
    }
  }

  private async getRevenueData(params: {
    startDate?: string;
    endDate?: string;
    courseId?: string;
    period?: string;
  }) {
    const now = new Date();
    const startDate = params.startDate
      ? new Date(params.startDate)
      : new Date(now.getFullYear(), 0, 1);
    const endDate = params.endDate ? new Date(params.endDate) : now;

    // Get transactions
    const transactions = await this.prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(params.courseId && { courseId: params.courseId }),
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate totals
    const completedTransactions = transactions.filter(
      (t) => t.status === 'success',
    );
    const pendingTransactions = transactions.filter(
      (t) => t.status === 'pending',
    );
    const failedTransactions = transactions.filter(
      (t) => t.status === 'failed' || t.status === 'cancelled',
    );

    const totalRevenue = transactions.reduce(
      (sum, t) => sum + (t.amount || 0),
      0,
    );
    const completedAmount = completedTransactions.reduce(
      (sum, t) => sum + (t.amount || 0),
      0,
    );
    const pendingAmount = pendingTransactions.reduce(
      (sum, t) => sum + (t.amount || 0),
      0,
    );
    const failedAmount = failedTransactions.reduce(
      (sum, t) => sum + (t.amount || 0),
      0,
    );
    const successRate =
      transactions.length > 0
        ? Math.round((completedTransactions.length / transactions.length) * 100)
        : 0;

    // Monthly revenue
    const monthlyRevenue: Record<
      string,
      { completed: number; pending: number; total: number }
    > = {};
    transactions.forEach((t) => {
      const monthKey = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyRevenue[monthKey]) {
        monthlyRevenue[monthKey] = { completed: 0, pending: 0, total: 0 };
      }
      monthlyRevenue[monthKey].total += t.amount || 0;
      if (t.status === 'success') {
        monthlyRevenue[monthKey].completed += t.amount || 0;
      } else {
        monthlyRevenue[monthKey].pending += t.amount || 0;
      }
    });

    // Quarterly revenue
    const quarterlyRevenue: Record<
      string,
      {
        completed: number;
        pending: number;
        total: number;
        transactionCount: number;
      }
    > = {};
    transactions.forEach((t) => {
      const quarter = Math.ceil((t.createdAt.getMonth() + 1) / 3);
      const quarterKey = `${t.createdAt.getFullYear()}-Q${quarter}`;
      if (!quarterlyRevenue[quarterKey]) {
        quarterlyRevenue[quarterKey] = {
          completed: 0,
          pending: 0,
          total: 0,
          transactionCount: 0,
        };
      }
      quarterlyRevenue[quarterKey].total += t.amount || 0;
      quarterlyRevenue[quarterKey].transactionCount++;
      if (t.status === 'success') {
        quarterlyRevenue[quarterKey].completed += t.amount || 0;
      } else {
        quarterlyRevenue[quarterKey].pending += t.amount || 0;
      }
    });

    // Yearly revenue
    const yearlyRevenue: Record<
      string,
      {
        completed: number;
        pending: number;
        total: number;
        transactionCount: number;
      }
    > = {};
    transactions.forEach((t) => {
      const yearKey = `${t.createdAt.getFullYear()}`;
      if (!yearlyRevenue[yearKey]) {
        yearlyRevenue[yearKey] = {
          completed: 0,
          pending: 0,
          total: 0,
          transactionCount: 0,
        };
      }
      yearlyRevenue[yearKey].total += t.amount || 0;
      yearlyRevenue[yearKey].transactionCount++;
      if (t.status === 'success') {
        yearlyRevenue[yearKey].completed += t.amount || 0;
      } else {
        yearlyRevenue[yearKey].pending += t.amount || 0;
      }
    });

    // Year-over-Year comparison
    const years = Object.keys(yearlyRevenue).sort();
    const yoyComparison: Array<{
      year: string;
      revenue: number;
      growth: number | null;
      growthPercent: string;
    }> = [];
    years.forEach((year, index) => {
      const currentRevenue = yearlyRevenue[year].completed;
      let growth: number | null = null;
      let growthPercent = 'N/A';

      if (index > 0) {
        const prevYear = years[index - 1];
        const prevRevenue = yearlyRevenue[prevYear].completed;
        growth = currentRevenue - prevRevenue;
        growthPercent =
          prevRevenue > 0
            ? `${growth >= 0 ? '+' : ''}${((growth / prevRevenue) * 100).toFixed(1)}%`
            : 'N/A';
      }

      yoyComparison.push({
        year,
        revenue: currentRevenue,
        growth,
        growthPercent,
      });
    });

    // Revenue by course
    const courseRevenueMap: Record<
      string,
      { name: string; revenue: number; count: number }
    > = {};
    transactions.forEach((t) => {
      const courseId = t.courseId || 'unknown';
      const courseName = t.course?.title || 'Khác';
      if (!courseRevenueMap[courseId]) {
        courseRevenueMap[courseId] = { name: courseName, revenue: 0, count: 0 };
      }
      if (t.status === 'success') {
        courseRevenueMap[courseId].revenue += t.amount || 0;
      }
      courseRevenueMap[courseId].count++;
    });

    const courseRevenue = Object.values(courseRevenueMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalRevenue,
      completedAmount,
      pendingAmount,
      failedAmount,
      successRate,
      totalTransactions: transactions.length,
      monthlyRevenue: Object.entries(monthlyRevenue).map(([month, data]) => ({
        month,
        ...data,
      })),
      quarterlyRevenue: Object.entries(quarterlyRevenue).map(
        ([quarter, data]) => ({
          quarter,
          ...data,
        }),
      ),
      yearlyRevenue: Object.entries(yearlyRevenue).map(([year, data]) => ({
        year,
        ...data,
      })),
      yoyComparison,
      courseRevenue,
    };
  }

  private async analyzeWithAI(data: any): Promise<any> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const prompt = `Phân tích dữ liệu doanh thu sau và đưa ra insights:

${JSON.stringify(data, null, 2)}

Trả về JSON với format:
{
  "summary": "Tóm tắt tình hình tài chính",
  "trend": "Xu hướng doanh thu (tăng/giảm/ổn định)",
  "forecast": "Dự báo doanh thu tháng tới",
  "concerns": ["Vấn đề cần lưu ý"],
  "recommendations": ["Đề xuất cải thiện doanh thu"],
  "topCourses": ["Khóa học mang lại doanh thu cao nhất"]
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

    // Chart 1: Line - Monthly revenue trend
    if (data.monthlyRevenue.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'line',
        title: 'Doanh thu theo thang',
        data: data.monthlyRevenue.map((m: any) => ({
          name: m.month,
          'Da thu': m.completed,
          'Cho thanh toan': m.pending,
        })),
        config: {
          xAxisKey: 'name',
          lines: [
            { dataKey: 'Da thu', color: '#10B981', strokeWidth: 2 },
            { dataKey: 'Cho thanh toan', color: '#F59E0B', strokeWidth: 2 },
          ],
        },
      });
    }

    // Chart 2: Bar - Quarterly revenue comparison
    if (data.quarterlyRevenue.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'bar',
        title: 'Doanh thu theo quy',
        data: data.quarterlyRevenue.map((q: any) => ({
          name: q.quarter,
          'Doanh thu': q.completed,
          'Giao dich': q.transactionCount,
        })),
        config: {
          xAxisKey: 'name',
          bars: [{ dataKey: 'Doanh thu', color: '#8B5CF6' }],
        },
      });
    }

    // Chart 3: Bar - Yearly revenue with YoY comparison
    if (data.yearlyRevenue.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'bar',
        title: 'Doanh thu theo nam',
        data: data.yearlyRevenue.map((y: any) => ({
          name: `Nam ${y.year}`,
          'Doanh thu': y.completed,
          'Cho xu ly': y.pending,
        })),
        config: {
          xAxisKey: 'name',
          bars: [
            { dataKey: 'Doanh thu', color: '#3B82F6' },
            { dataKey: 'Cho xu ly', color: '#F59E0B' },
          ],
        },
      });
    }

    // Chart 4: Line - Year-over-Year growth comparison
    if (data.yoyComparison && data.yoyComparison.length > 1) {
      charts.push({
        type: 'chart',
        chartType: 'bar',
        title: 'So sanh tang truong theo nam (YoY)',
        data: data.yoyComparison.map((y: any) => ({
          name: `Nam ${y.year}`,
          'Doanh thu': y.revenue,
          'Tang truong': y.growth || 0,
        })),
        config: {
          xAxisKey: 'name',
          bars: [{ dataKey: 'Doanh thu', color: '#10B981' }],
        },
      });
    }

    // Chart 5: Bar - Revenue by course
    if (data.courseRevenue.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'bar',
        title: 'Doanh thu theo khoa hoc',
        data: data.courseRevenue.map((c: any) => ({
          name: c.name.substring(0, 20),
          'Doanh thu': c.revenue,
        })),
        config: {
          xAxisKey: 'name',
          bars: [{ dataKey: 'Doanh thu', color: '#3B82F6' }],
        },
      });
    }

    // Chart 6: Pie - Payment status distribution
    charts.push({
      type: 'chart',
      chartType: 'pie',
      title: 'Ty le thanh toan',
      data: [
        { name: 'Thanh cong', value: data.completedAmount },
        { name: 'Cho xu ly', value: data.pendingAmount },
        { name: 'That bai', value: data.failedAmount },
      ].filter((d) => d.value > 0),
      config: {
        colors: ['#10B981', '#F59E0B', '#EF4444'],
      },
    });

    // Chart 7: Area - Cumulative revenue
    if (data.monthlyRevenue.length > 0) {
      let cumulative = 0;
      charts.push({
        type: 'chart',
        chartType: 'area',
        title: 'Doanh thu tich luy',
        data: data.monthlyRevenue.map((m: any) => {
          cumulative += m.completed;
          return {
            name: m.month,
            'Tich luy': cumulative,
          };
        }),
        config: {
          xAxisKey: 'name',
          areas: [{ dataKey: 'Tich luy', color: '#8B5CF6', fillOpacity: 0.3 }],
        },
      });
    }

    return charts;
  }
}
