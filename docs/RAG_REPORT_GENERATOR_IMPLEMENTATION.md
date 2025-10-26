# RAG Report Generator - Xuất Báo Cáo Thông Minh 📊

## 🎯 Mục tiêu

Phát triển tính năng RAG để tự động:
1. **Phân tích dữ liệu** từ câu hỏi người dùng
2. **Gợi ý định dạng** xuất báo cáo phù hợp (PDF, Word, Excel)
3. **Tạo báo cáo tự động** với layout đẹp, chuyên nghiệp
4. **Tối ưu cho từng loại dữ liệu**:
   - **Excel**: Dữ liệu bảng, số liệu, thống kê
   - **PDF**: Báo cáo chính thức, chứng chỉ, bảng điểm
   - **Word**: Báo cáo chi tiết, có formatting phức tạp

---

## 📐 Kiến trúc

```
User Query
    ↓
AI Agent (LangChain)
    ↓
Report Advisor Tool (phân tích & gợi ý format)
    ↓
Report Generator Service
    ├── PDF Export Tool (puppeteer/pdfkit)
    ├── Word Export Tool (docx)
    └── Excel Export Tool (exceljs) [✅ Đã có]
    ↓
File được lưu vào uploads/reports/
    ↓
Return download URL
```

---

## 🛠️ Implementation Plan

### **Phase 1: Report Generator Service** (Core Logic)

**File**: `apps/client-api/src/domains/agent/service/report-generator.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaRepository } from '@app/database';

export interface ReportData {
  title: string;
  description?: string;
  data: any[]; // Array of records
  metadata?: {
    generatedBy?: string;
    generatedAt?: string;
    filters?: Record<string, any>;
  };
}

export interface ReportOptions {
  format: 'pdf' | 'word' | 'excel';
  template?: string; // 'student-performance' | 'course-analytics' | 'custom'
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
    // Analyze data structure
    const recordCount = data.length;
    const firstRecord = data[0] || {};
    const fieldCount = Object.keys(firstRecord).length;

    // Check if data contains complex objects
    const hasComplexData = Object.values(firstRecord).some(
      v => typeof v === 'object' && v !== null
    );

    // Decision logic
    if (recordCount > 100 && fieldCount > 5 && !hasComplexData) {
      return {
        format: 'excel',
        reason: 'Dữ liệu dạng bảng lớn (>100 rows, >5 columns) phù hợp với Excel để phân tích',
        confidence: 0.9,
      };
    }

    if (hasComplexData || fieldCount > 15) {
      return {
        format: 'word',
        reason: 'Dữ liệu phức tạp hoặc nhiều trường (>15) phù hợp với Word để trình bày chi tiết',
        confidence: 0.85,
      };
    }

    if (recordCount < 50) {
      return {
        format: 'pdf',
        reason: 'Báo cáo nhỏ (<50 records) phù hợp với PDF để in ấn và lưu trữ chính thức',
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
    Object.keys(data[0] || {}).forEach(key => {
      const values = data.map(d => d[key]).filter(v => typeof v === 'number');

      if (values.length > 0) {
        stats[`${key}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
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
    reportType: string
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

  private async prepareStudentPerformanceReport(data: any): Promise<ReportData> {
    // Query student progress data
    const students = Array.isArray(data) ? data : [data];

    return {
      title: 'Báo Cáo Kết Quả Học Tập',
      description: 'Thống kê chi tiết về tiến độ và điểm số của học viên',
      data: students.map(s => ({
        'Họ và Tên': s.displayName || `${s.firstName} ${s.lastName}`,
        'Email': s.email,
        'Số Khóa Học': s.enrollments?.length || 0,
        'Điểm Trung Bình': this.calculateAvgScore(s),
        'Tiến Độ (%)': this.calculateProgress(s),
        'Trạng Thái': this.getStudentStatus(s),
      })),
      metadata: {
        generatedAt: new Date().toISOString(),
        reportType: 'student-performance',
      },
    };
  }

  private async prepareCourseAnalyticsReport(data: any): Promise<ReportData> {
    const courses = Array.isArray(data) ? data : [data];

    return {
      title: 'Phân Tích Khóa Học',
      description: 'Thống kê về hiệu suất và độ phổ biến của các khóa học',
      data: courses.map(c => ({
        'Tên Khóa Học': c.title,
        'Giáo Viên': c.instructor?.displayName,
        'Số Học Viên': c.enrollments?.length || 0,
        'Điểm Đánh Giá': c.averageRating || 'N/A',
        'Tỷ Lệ Hoàn Thành (%)': this.calculateCompletionRate(c),
        'Trạng Thái': c.isPublished ? 'Đã xuất bản' : 'Nháp',
      })),
      metadata: {
        generatedAt: new Date().toISOString(),
        reportType: 'course-analytics',
      },
    };
  }

  private async prepareClassroomSummaryReport(data: any): Promise<ReportData> {
    const classrooms = Array.isArray(data) ? data : [data];

    return {
      title: 'Tổng Quan Lớp Học',
      description: 'Thống kê về các lớp học và hoạt động',
      data: classrooms.map(c => ({
        'Tên Lớp': c.name,
        'Mã Lớp': c.classCode,
        'Giáo Viên': c.teacher?.displayName,
        'Số Học Viên': c.enrollments?.length || 0,
        'Ngày Bắt Đầu': new Date(c.startDate).toLocaleDateString('vi-VN'),
        'Ngày Kết Thúc': new Date(c.endDate).toLocaleDateString('vi-VN'),
        'Trạng Thái': c.status,
      })),
      metadata: {
        generatedAt: new Date().toISOString(),
        reportType: 'classroom-summary',
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
        reportType: 'generic',
      },
    };
  }

  // Helper methods
  private calculateAvgScore(student: any): string {
    // Logic to calculate average score from enrollments
    return 'N/A';
  }

  private calculateProgress(student: any): number {
    // Logic to calculate overall progress
    return 0;
  }

  private getStudentStatus(student: any): string {
    // Logic to determine student status
    return 'Đang học';
  }

  private calculateCompletionRate(course: any): number {
    // Logic to calculate course completion rate
    return 0;
  }
}
```

---

### **Phase 2: PDF Export Tool**

**File**: `apps/client-api/src/domains/agent/tools/pdf-export.tool.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Tool } from 'langchain/tools';
import * as PDFDocument from 'pdfkit';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class PdfExportTool extends Tool {
  name = 'pdf_export';
  description = `
Export data to PDF file with professional layout.

Input should be a JSON string with:
{
  "filename": "ten_file",
  "data": [...], // Array of objects
  "title": "Báo cáo",
  "description": "Mô tả báo cáo",
  "includeStatistics": true, // Optional
  "pageOrientation": "portrait" // or "landscape"
}

Returns:
{
  "success": true,
  "filename": "ten_file.pdf",
  "downloadUrl": "/api/public/v1/ai/download/ten_file.pdf"
}
`;

  private readonly logger = new Logger(PdfExportTool.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'reports');

  constructor() {
    super();
    this.ensureUploadsDirExists();
  }

  private async ensureUploadsDirExists() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      this.logger.log(`📁 Reports directory ready: ${this.uploadsDir}`);
    } catch (error) {
      this.logger.error('Failed to create reports directory:', error);
    }
  }

  async _call(input: string): Promise<string> {
    try {
      this.logger.log(`📄 PDF Export input: ${input.substring(0, 200)}...`);

      const parsedInput = JSON.parse(input);
      const {
        filename,
        data,
        title = 'Report',
        description,
        includeStatistics = false,
        pageOrientation = 'portrait',
      } = parsedInput;

      if (!Array.isArray(data) || data.length === 0) {
        return JSON.stringify({
          success: false,
          error: 'Data must be a non-empty array',
        });
      }

      if (!filename) {
        return JSON.stringify({
          success: false,
          error: 'Filename is required',
        });
      }

      // Create PDF
      const doc = new PDFDocument({
        size: 'A4',
        layout: pageOrientation,
        margin: 50,
      });

      const timestamp = Date.now();
      const safeFilename = filename.replace(/[^a-z0-9_-]/gi, '_');
      const fullFilename = `${safeFilename}_${timestamp}.pdf`;
      const filePath = join(this.uploadsDir, fullFilename);

      const stream = doc.pipe(require('fs').createWriteStream(filePath));

      // Add header
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(title, { align: 'center' });

      doc.moveDown();

      if (description) {
        doc
          .fontSize(12)
          .font('Helvetica')
          .text(description, { align: 'center' });
        doc.moveDown();
      }

      // Add generation date
      doc
        .fontSize(10)
        .text(`Ngày tạo: ${new Date().toLocaleString('vi-VN')}`, {
          align: 'right',
        });

      doc.moveDown(2);

      // Add statistics if requested
      if (includeStatistics) {
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Thống kê tổng quan');
        doc.moveDown();

        doc
          .fontSize(11)
          .font('Helvetica')
          .text(`Tổng số bản ghi: ${data.length}`);
        doc.text(`Số trường: ${Object.keys(data[0]).length}`);

        doc.moveDown(2);
      }

      // Add table header
      const headers = Object.keys(data[0]);
      const colWidth = (doc.page.width - 100) / headers.length;

      doc.fontSize(10).font('Helvetica-Bold');
      let xPos = 50;
      headers.forEach(header => {
        doc.text(header, xPos, doc.y, {
          width: colWidth,
          align: 'left',
        });
        xPos += colWidth;
      });

      doc.moveDown();
      doc.strokeColor('#000000').lineWidth(1);
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
      doc.moveDown();

      // Add table rows
      doc.fontSize(9).font('Helvetica');
      data.forEach((row, idx) => {
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
          doc.y = 50;
        }

        xPos = 50;
        headers.forEach(header => {
          const value = row[header] ?? '';
          doc.text(String(value).substring(0, 50), xPos, doc.y, {
            width: colWidth,
            align: 'left',
          });
          xPos += colWidth;
        });

        doc.moveDown(0.5);

        // Add separator line every 5 rows
        if ((idx + 1) % 5 === 0) {
          doc.strokeColor('#cccccc').lineWidth(0.5);
          doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
          doc.moveDown(0.5);
        }
      });

      // Add footer
      doc
        .fontSize(8)
        .text(
          `Trang ${doc.bufferedPageRange().count}`,
          50,
          doc.page.height - 50,
          { align: 'center' }
        );

      // Finalize PDF
      doc.end();

      await new Promise(resolve => stream.on('finish', resolve));

      this.logger.log(`✅ PDF file created: ${fullFilename}`);

      const apiPort = process.env.CLIENT_API_PORT || '3000';
      const apiBaseUrl = `http://localhost:${apiPort}`;

      return JSON.stringify({
        success: true,
        filename: fullFilename,
        downloadUrl: `/api/public/v1/ai/download/${fullFilename}`,
        fullDownloadUrl: `${apiBaseUrl}/api/public/v1/ai/download/${fullFilename}`,
        message: `File PDF "${fullFilename}" đã được tạo thành công với ${data.length} bản ghi.`,
        recordCount: data.length,
      });
    } catch (error) {
      this.logger.error('❌ PDF export error:', error);
      return JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate PDF file',
      });
    }
  }
}
```

---

### **Phase 3: Word Export Tool**

**File**: `apps/client-api/src/domains/agent/tools/word-export.tool.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Tool } from 'langchain/tools';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class WordExportTool extends Tool {
  name = 'word_export';
  description = `
Export data to Word document (.docx) with rich formatting.

Input should be a JSON string with:
{
  "filename": "ten_file",
  "data": [...],
  "title": "Báo cáo",
  "description": "Mô tả",
  "includeStatistics": true
}

Returns:
{
  "success": true,
  "filename": "ten_file.docx",
  "downloadUrl": "/api/public/v1/ai/download/ten_file.docx"
}
`;

  private readonly logger = new Logger(WordExportTool.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'reports');

  constructor() {
    super();
    this.ensureUploadsDirExists();
  }

  private async ensureUploadsDirExists() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create reports directory:', error);
    }
  }

  async _call(input: string): Promise<string> {
    try {
      this.logger.log(`📝 Word Export input: ${input.substring(0, 200)}...`);

      const parsedInput = JSON.parse(input);
      const {
        filename,
        data,
        title = 'Report',
        description,
        includeStatistics = false,
      } = parsedInput;

      if (!Array.isArray(data) || data.length === 0) {
        return JSON.stringify({
          success: false,
          error: 'Data must be a non-empty array',
        });
      }

      // Create document
      const sections: any[] = [];

      // Title
      sections.push(
        new Paragraph({
          text: title,
          heading: 'Heading1',
          spacing: { after: 200 },
        })
      );

      // Description
      if (description) {
        sections.push(
          new Paragraph({
            text: description,
            spacing: { after: 200 },
          })
        );
      }

      // Generation date
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Ngày tạo: ${new Date().toLocaleString('vi-VN')}`,
              italics: true,
              size: 20,
            }),
          ],
          spacing: { after: 400 },
        })
      );

      // Statistics
      if (includeStatistics) {
        sections.push(
          new Paragraph({
            text: 'Thống kê tổng quan',
            heading: 'Heading2',
            spacing: { before: 200, after: 200 },
          })
        );

        sections.push(
          new Paragraph({
            text: `• Tổng số bản ghi: ${data.length}`,
          })
        );

        sections.push(
          new Paragraph({
            text: `• Số trường: ${Object.keys(data[0]).length}`,
            spacing: { after: 400 },
          })
        );
      }

      // Table
      const headers = Object.keys(data[0]);

      const tableRows = [
        // Header row
        new TableRow({
          children: headers.map(
            h =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: h, bold: true }),
                    ],
                  }),
                ],
                shading: { fill: '4472C4' },
              })
          ),
        }),
        // Data rows
        ...data.map(
          row =>
            new TableRow({
              children: headers.map(
                h =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        text: String(row[h] ?? ''),
                      }),
                    ],
                  })
              ),
            })
        ),
      ];

      const table = new Table({
        rows: tableRows,
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
      });

      sections.push(table);

      // Create document
      const doc = new Document({
        sections: [
          {
            children: sections,
          },
        ],
      });

      // Save file
      const timestamp = Date.now();
      const safeFilename = filename.replace(/[^a-z0-9_-]/gi, '_');
      const fullFilename = `${safeFilename}_${timestamp}.docx`;
      const filePath = join(this.uploadsDir, fullFilename);

      const buffer = await Packer.toBuffer(doc);
      await fs.writeFile(filePath, buffer);

      this.logger.log(`✅ Word file created: ${fullFilename}`);

      const apiPort = process.env.CLIENT_API_PORT || '3000';
      const apiBaseUrl = `http://localhost:${apiPort}`;

      return JSON.stringify({
        success: true,
        filename: fullFilename,
        downloadUrl: `/api/public/v1/ai/download/${fullFilename}`,
        fullDownloadUrl: `${apiBaseUrl}/api/public/v1/ai/download/${fullFilename}`,
        message: `File Word "${fullFilename}" đã được tạo thành công với ${data.length} bản ghi.`,
        recordCount: data.length,
      });
    } catch (error) {
      this.logger.error('❌ Word export error:', error);
      return JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate Word file',
      });
    }
  }
}
```

---

### **Phase 4: Report Advisor Tool** (AI gợi ý format)

**File**: `apps/client-api/src/domains/agent/tools/report-advisor.tool.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Tool } from 'langchain/tools';
import { ReportGeneratorService } from '../service/report-generator.service';

@Injectable()
export class ReportAdvisorTool extends Tool {
  name = 'report_advisor';
  description = `
Analyze data and suggest the best report format (PDF, Word, Excel).

Input should be a JSON string with:
{
  "data": [...], // Array of objects to analyze
  "context": "student performance" // Optional context
}

Returns:
{
  "suggestedFormat": "excel",
  "reason": "...",
  "confidence": 0.9,
  "alternatives": [
    {"format": "pdf", "reason": "...", "confidence": 0.7}
  ]
}
`;

  private readonly logger = new Logger(ReportAdvisorTool.name);

  constructor(private reportGenerator: ReportGeneratorService) {
    super();
  }

  async _call(input: string): Promise<string> {
    try {
      this.logger.log(`🧠 Report Advisor input: ${input.substring(0, 200)}...`);

      const parsedInput = JSON.parse(input);
      const { data, context } = parsedInput;

      if (!Array.isArray(data) || data.length === 0) {
        return JSON.stringify({
          error: 'Data must be a non-empty array',
        });
      }

      // Get primary suggestion
      const suggestion = await this.reportGenerator.suggestReportFormat(data);

      // Generate alternatives
      const alternatives = [];

      if (suggestion.format !== 'pdf') {
        alternatives.push({
          format: 'pdf',
          reason: 'Phù hợp cho báo cáo chính thức, dễ in ấn và lưu trữ',
          confidence: 0.75,
        });
      }

      if (suggestion.format !== 'excel') {
        alternatives.push({
          format: 'excel',
          reason: 'Phù hợp cho phân tích dữ liệu, có thể tính toán và sắp xếp',
          confidence: 0.7,
        });
      }

      if (suggestion.format !== 'word') {
        alternatives.push({
          format: 'word',
          reason: 'Phù hợp cho báo cáo chi tiết, dễ chỉnh sửa và formatting',
          confidence: 0.65,
        });
      }

      this.logger.log(
        `✅ Report format suggested: ${suggestion.format} (confidence: ${suggestion.confidence})`
      );

      return JSON.stringify({
        suggestedFormat: suggestion.format,
        reason: suggestion.reason,
        confidence: suggestion.confidence,
        alternatives,
        statistics: {
          recordCount: data.length,
          fieldCount: Object.keys(data[0] || {}).length,
        },
      });
    } catch (error) {
      this.logger.error('❌ Report advisor error:', error);
      return JSON.stringify({
        error: error.message || 'Failed to analyze data',
      });
    }
  }
}
```

---

## 📦 Dependencies

Thêm vào `package.json`:

```json
{
  "dependencies": {
    "exceljs": "^4.3.0",     // ✅ Đã có
    "pdfkit": "^0.14.0",      // 🆕 For PDF generation
    "docx": "^8.5.0",         // 🆕 For Word generation
    "@types/pdfkit": "^0.13.0"
  }
}
```

Install:
```bash
npm install pdfkit docx @types/pdfkit
```

---

## 🔧 Integration

### 1. Update Agent Module

**File**: `apps/client-api/src/domains/agent/agent.module.ts`

```typescript
import { PdfExportTool } from './tools/pdf-export.tool';
import { WordExportTool } from './tools/word-export.tool';
import { ReportAdvisorTool } from './tools/report-advisor.tool';
import { ReportGeneratorService } from './service/report-generator.service';

@Module({
  // ...
  providers: [
    // ... existing providers
    ReportGeneratorService,
    PdfExportTool,
    WordExportTool,
    ReportAdvisorTool,
  ],
})
export class AgentModule {}
```

### 2. Register Tools in LangChain Agent

**File**: `apps/client-api/src/domains/agent/service/langchain-agent.service.ts`

```typescript
import { PdfExportTool } from '../tools/pdf-export.tool';
import { WordExportTool } from '../tools/word-export.tool';
import { ReportAdvisorTool } from '../tools/report-advisor.tool';

@Injectable()
export class LangChainAgentService {
  constructor(
    // ... existing tools
    private pdfExportTool: PdfExportTool,
    private wordExportTool: WordExportTool,
    private reportAdvisorTool: ReportAdvisorTool,
  ) {}

  private getTools(): Tool[] {
    return [
      // ... existing tools
      this.pdfExportTool,
      this.wordExportTool,
      this.reportAdvisorTool,
    ];
  }
}
```

### 3. Add Download Endpoint

**File**: `apps/client-api/src/domains/agent/controller/private-agent.controller.ts`

```typescript
@Get('download/:filename')
async downloadReport(
  @Param('filename') filename: string,
  @Res() res: Response,
) {
  const filePath = join(process.cwd(), 'uploads', 'reports', filename);

  // Security: validate filename
  if (!filename.match(/^[a-z0-9_-]+\.(pdf|docx|xlsx)$/i)) {
    throw new BadRequestException('Invalid filename');
  }

  if (!existsSync(filePath)) {
    throw new NotFoundException('File not found');
  }

  // Set content type based on extension
  const ext = filename.split('.').pop().toLowerCase();
  const contentTypes = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  return res.sendFile(filePath);
}
```

---

## 💡 Usage Examples

### Example 1: AI tự động gợi ý format

**User**: "Tạo báo cáo danh sách 150 học viên với điểm số"

**AI Flow**:
```
1. SQL Tool → Query 150 students with scores
2. Report Advisor Tool → Analyze data
   → Suggest: Excel (confidence: 0.9)
   → Reason: "Dữ liệu bảng lớn >100 rows phù hợp Excel"
3. Excel Export Tool → Generate report
4. Return: "Báo cáo đã sẵn sàng! [Download Excel]"
```

### Example 2: User chỉ định format

**User**: "Xuất báo cáo 20 khóa học ra PDF"

**AI Flow**:
```
1. SQL Tool → Query 20 courses
2. PDF Export Tool → Generate PDF report
3. Return: "Báo cáo PDF đã được tạo! [Download PDF]"
```

### Example 3: Báo cáo phức tạp

**User**: "Tạo báo cáo chi tiết về hiệu suất học viên trong lớp ABC, bao gồm biểu đồ"

**AI Flow**:
```
1. SQL Tool → Query classroom ABC students
2. Report Advisor Tool → Suggest Word (has complex data)
3. Chart Generator Tool → Generate charts
4. Word Export Tool → Generate report with embedded charts
5. Return: "Báo cáo Word chi tiết đã sẵn sàng! [Download]"
```

---

## 🧪 Testing

### Test Report Advisor

```bash
curl -X POST http://localhost:3000/api/private/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Phân tích và gợi ý format cho dữ liệu: [{\"name\":\"A\",\"score\":90}, {\"name\":\"B\",\"score\":85}]"
  }'
```

### Test PDF Export

```bash
curl -X POST http://localhost:3000/api/private/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Tạo báo cáo PDF cho danh sách 5 học viên có điểm cao nhất"
  }'
```

---

## 📈 Future Enhancements

1. **Custom Templates**: Thêm templates cho từng loại báo cáo (student, course, classroom)
2. **Charts in PDF/Word**: Embed charts từ Chart Generator vào PDF/Word
3. **Email Integration**: Tự động gửi báo cáo qua email
4. **Scheduled Reports**: Tạo báo cáo định kỳ (weekly, monthly)
5. **Report History**: Lưu lịch sử các báo cáo đã tạo
6. **Custom Branding**: Logo, màu sắc, font chữ theo brand

---

## 🎯 Success Metrics

- **Format Accuracy**: AI gợi ý đúng format >85% cases
- **Generation Speed**: <5s cho báo cáo <100 records
- **File Size**: <5MB cho báo cáo thông thường
- **Error Rate**: <1% lỗi khi generate

---

**Tạo bởi**: AI Assistant
**Ngày**: 2025-10-25
**Status**: 📋 Ready for Implementation


