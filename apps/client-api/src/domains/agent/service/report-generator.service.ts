import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';

export interface ReportData {
  title: string;
  description?: string;
  data: any[];
  metadata?: {
    generatedBy?: string;
    generatedAt?: string;
    filters?: Record<string, any>;
  };
}

export interface ReportOptions {
  format: 'pdf' | 'word' | 'excel';
  template?: string;
  includeCharts?: boolean;
  includeStatistics?: boolean;
  pageOrientation?: 'portrait' | 'landscape';
}

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(private prisma: PrismaRepository) {}

  /**
   * 🧠 AI-powered: Analyze data and suggest best report format
   */
  async suggestReportFormat(data: any[]): Promise<{
    format: 'pdf' | 'word' | 'excel';
    reason: string;
    confidence: number;
  }> {
    if (!data || data.length === 0) {
      return {
        format: 'pdf',
        reason: 'Không có dữ liệu, sử dụng PDF mặc định',
        confidence: 0.5,
      };
    }

    const recordCount = data.length;
    const firstRecord = data[0] || {};
    const fieldCount = Object.keys(firstRecord).length;

    // Check if data contains complex objects
    const hasComplexData = Object.values(firstRecord).some(
      (v) => typeof v === 'object' && v !== null,
    );

    // Decision logic
    if (recordCount > 100 && fieldCount > 5 && !hasComplexData) {
      return {
        format: 'excel',
        reason:
          'Dữ liệu dạng bảng lớn (>100 rows, >5 columns) phù hợp với Excel để phân tích',
        confidence: 0.9,
      };
    }

    if (hasComplexData || fieldCount > 15) {
      return {
        format: 'word',
        reason:
          'Dữ liệu phức tạp hoặc nhiều trường (>15) phù hợp với Word để trình bày chi tiết',
        confidence: 0.85,
      };
    }

    if (recordCount < 50) {
      return {
        format: 'pdf',
        reason:
          'Báo cáo nhỏ (<50 records) phù hợp với PDF để in ấn và lưu trữ chính thức',
        confidence: 0.8,
      };
    }

    // Default
    return {
      format: 'excel',
      reason: 'Mặc định sử dụng Excel cho dữ liệu dạng bảng',
      confidence: 0.7,
    };
  }

  /**
   * Generate report statistics
   */
  generateStatistics(data: any[]): Record<string, any> {
    if (data.length === 0) return {};

    const stats: Record<string, any> = {
      totalRecords: data.length,
      fields: Object.keys(data[0] || {}),
    };

    // Calculate numeric statistics
    Object.keys(data[0] || {}).forEach((key) => {
      const values = data
        .map((d) => d[key])
        .filter((v) => typeof v === 'number');

      if (values.length > 0) {
        stats[`${key}_avg`] =
          Math.round(
            (values.reduce((a, b) => a + b, 0) / values.length) * 100,
          ) / 100;
        stats[`${key}_min`] = Math.min(...values);
        stats[`${key}_max`] = Math.max(...values);
        stats[`${key}_sum`] = values.reduce((a, b) => a + b, 0);
      }
    });

    return stats;
  }

  /**
   * Prepare data for specific report type
   */
  async prepareReportData(
    queryResult: any,
    reportType: string,
  ): Promise<ReportData> {
    switch (reportType) {
      case 'student-performance':
        return this.prepareStudentPerformanceReport(queryResult);
      case 'course-analytics':
        return this.prepareCourseAnalyticsReport(queryResult);
      case 'classroom-summary':
        return this.prepareClassroomSummaryReport(queryResult);
      default:
        return this.prepareGenericReport(queryResult);
    }
  }

  private async prepareStudentPerformanceReport(
    data: any,
  ): Promise<ReportData> {
    const students = Array.isArray(data) ? data : [data];

    return {
      title: 'Báo Cáo Kết Quả Học Tập',
      description: 'Thống kê chi tiết về tiến độ và điểm số của học viên',
      data: students.map((s) => ({
        'Họ và Tên': s.displayName || `${s.firstName} ${s.lastName}`,
        Email: s.email,
        'Số Khóa Học': s.enrollments?.length || 0,
        'Điểm Trung Bình': this.calculateAvgScore(s),
        'Tiến Độ (%)': this.calculateProgress(s),
        'Trạng Thái': this.getStudentStatus(s),
      })),
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private async prepareCourseAnalyticsReport(data: any): Promise<ReportData> {
    const courses = Array.isArray(data) ? data : [data];

    return {
      title: 'Phân Tích Khóa Học',
      description: 'Thống kê về hiệu suất và độ phổ biến của các khóa học',
      data: courses.map((c) => ({
        'Tên Khóa Học': c.title,
        'Giáo Viên': c.instructor?.displayName || 'N/A',
        'Số Học Viên': c.enrollments?.length || 0,
        'Điểm Đánh Giá': c.averageRating || 'N/A',
        'Tỷ Lệ Hoàn Thành (%)': this.calculateCompletionRate(c),
        'Trạng Thái': c.isPublished ? 'Đã xuất bản' : 'Nháp',
      })),
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private async prepareClassroomSummaryReport(data: any): Promise<ReportData> {
    const classrooms = Array.isArray(data) ? data : [data];

    return {
      title: 'Tổng Quan Lớp Học',
      description: 'Thống kê về các lớp học và hoạt động',
      data: classrooms.map((c) => ({
        'Tên Lớp': c.name,
        'Mã Lớp': c.classCode,
        'Giáo Viên': c.teacher?.displayName || 'N/A',
        'Số Học Viên': c.enrollments?.length || 0,
        'Ngày Bắt Đầu': c.startDate
          ? new Date(c.startDate).toLocaleDateString('vi-VN')
          : 'N/A',
        'Ngày Kết Thúc': c.endDate
          ? new Date(c.endDate).toLocaleDateString('vi-VN')
          : 'N/A',
        'Trạng Thái': c.status || 'N/A',
      })),
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private prepareGenericReport(data: any): ReportData {
    const records = Array.isArray(data) ? data : [data];

    return {
      title: 'Báo Cáo Dữ Liệu',
      description: 'Báo cáo tổng hợp dữ liệu hệ thống',
      data: records,
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  }

  // Helper methods
  private calculateAvgScore(student: any): string {
    if (!student.enrollments || student.enrollments.length === 0) {
      return 'N/A';
    }
    // Simple mock calculation
    return '85.5';
  }

  private calculateProgress(student: any): number {
    if (!student.enrollments || student.enrollments.length === 0) {
      return 0;
    }
    // Simple mock calculation
    return 75;
  }

  private getStudentStatus(student: any): string {
    return 'Đang học';
  }

  private calculateCompletionRate(course: any): number {
    if (!course.enrollments || course.enrollments.length === 0) {
      return 0;
    }
    // Simple mock calculation
    return 68;
  }
}
