import { PrismaRepository } from '@app/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { Tool } from 'langchain/tools';

@Injectable()
export class RevenueAnalyticsTool extends Tool {
  name = 'analyze_revenue';
  description = `Phân tích doanh thu và tài chính với AI insights và tạo nhiều biểu đồ.

TRIGGER: Sử dụng khi admin muốn:
- "phân tích doanh thu"
- "báo cáo tài chính"
- "học phí tháng này"
- "doanh thu theo khóa học"
- "thống kê thanh toán"
- "transaction report"

INPUT: JSON với các trường:
- startDate (optional): Ngày bắt đầu (ISO string)
- endDate (optional): Ngày kết thúc (ISO string)
- courseId (optional): ID khóa học cụ thể
- period (optional): 'month' | 'quarter' | 'year'

OUTPUT: Trả về:
- Tổng doanh thu, doanh thu theo tháng/khóa
- Tỷ lệ thanh toán (completed/pending/failed)
- 4-5 biểu đồ trực quan
- AI insights và dự báo`;

  private readonly logger = new Logger(RevenueAnalyticsTool.name);
  private genAI: GoogleGenerativeAI;

  constructor(private prisma: PrismaRepository) {
    super();
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async _call(input: string): Promise<string> {
    try {
      this.logger.log(`💰 Revenue Analytics Tool called with: ${input}`);

      let params: { startDate?: string; endDate?: string; courseId?: string; period?: string } = {};
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

  private async getRevenueData(params: { startDate?: string; endDate?: string; courseId?: string; period?: string }) {
    const now = new Date();
    const startDate = params.startDate ? new Date(params.startDate) : new Date(now.getFullYear(), 0, 1);
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
    const completedTransactions = transactions.filter((t) => t.status === 'success');
    const pendingTransactions = transactions.filter((t) => t.status === 'pending');
    const failedTransactions = transactions.filter((t) => t.status === 'failed' || t.status === 'cancelled');

    const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const completedAmount = completedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const pendingAmount = pendingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const failedAmount = failedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const successRate = transactions.length > 0 ? Math.round((completedTransactions.length / transactions.length) * 100) : 0;

    // Monthly revenue
    const monthlyRevenue: Record<string, { completed: number; pending: number; total: number }> = {};
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

    // Revenue by course
    const courseRevenueMap: Record<string, { name: string; revenue: number; count: number }> = {};
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
      courseRevenue,
    };
  }

  private async analyzeWithAI(data: any): Promise<any> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
        title: 'Doanh thu theo tháng',
        data: data.monthlyRevenue.map((m: any) => ({
          name: m.month,
          'Đã thu': m.completed,
          'Chờ thanh toán': m.pending,
        })),
        config: {
          xAxisKey: 'name',
          lines: [
            { dataKey: 'Đã thu', color: '#10B981', strokeWidth: 2 },
            { dataKey: 'Chờ thanh toán', color: '#F59E0B', strokeWidth: 2 },
          ],
        },
      });
    }

    // Chart 2: Bar - Revenue by course
    if (data.courseRevenue.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'bar',
        title: '💰 Doanh thu theo khóa học',
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

    // Chart 3: Pie - Payment status distribution
    charts.push({
      type: 'chart',
      chartType: 'pie',
      title: 'Tỷ lệ thanh toán',
      data: [
        { name: 'Thành công', value: data.completedAmount },
        { name: 'Chờ xử lý', value: data.pendingAmount },
        { name: 'Thất bại', value: data.failedAmount },
      ].filter((d) => d.value > 0),
      config: {
        colors: ['#10B981', '#F59E0B', '#EF4444'],
      },
    });

    // Chart 4: Area - Cumulative revenue
    if (data.monthlyRevenue.length > 0) {
      let cumulative = 0;
      charts.push({
        type: 'chart',
        chartType: 'area',
        title: 'Doanh thu tích lũy',
        data: data.monthlyRevenue.map((m: any) => {
          cumulative += m.completed;
          return {
            name: m.month,
            'Tích lũy': cumulative,
          };
        }),
        config: {
          xAxisKey: 'name',
          areas: [{ dataKey: 'Tích lũy', color: '#8B5CF6', fillOpacity: 0.3 }],
        },
      });
    }

    return charts;
  }
}
