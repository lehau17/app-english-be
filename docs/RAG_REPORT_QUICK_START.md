# RAG Report Generator - Quick Start 🚀

## 🎯 Tóm Tắt

Thêm khả năng cho RAG AI:
- **Tự động phân tích** dữ liệu và gợi ý format phù hợp
- **Xuất báo cáo** ra PDF, Word, Excel
- **Tối ưu cho từng loại dữ liệu**

---

## 📊 Khi Nào Dùng Format Nào?

| Format | Dùng Khi | Ví Dụ |
|--------|----------|-------|
| **Excel** | Dữ liệu dạng bảng lớn (>100 rows)<br/>Cần phân tích, sắp xếp, tính toán | Danh sách 200 học viên với điểm<br/>Thống kê doanh thu theo tháng |
| **PDF** | Báo cáo chính thức, cần in ấn<br/>Dữ liệu nhỏ (<50 records)<br/>Bảng điểm, chứng chỉ | Bảng điểm cuối kỳ<br/>Báo cáo tháng cho BGĐ |
| **Word** | Báo cáo chi tiết, cần format phức tạp<br/>Nhiều trường (>15 columns)<br/>Có text mô tả dài | Báo cáo đánh giá chi tiết<br/>Tài liệu hướng dẫn |

---

## 🔥 Quick Implementation (30 phút)

### Step 1: Install Dependencies (2 phút)

```bash
cd english-learning
npm install pdfkit docx @types/pdfkit
```

### Step 2: Tạo Files (15 phút)

Copy code từ `RAG_REPORT_GENERATOR_IMPLEMENTATION.md` vào:

```
apps/client-api/src/domains/agent/
├── service/
│   └── report-generator.service.ts     [🆕 Core logic]
└── tools/
    ├── pdf-export.tool.ts              [🆕 PDF export]
    ├── word-export.tool.ts             [🆕 Word export]
    └── report-advisor.tool.ts          [🆕 AI advisor]
```

### Step 3: Update Module (5 phút)

```typescript
// agent.module.ts
import { ReportGeneratorService } from './service/report-generator.service';
import { PdfExportTool } from './tools/pdf-export.tool';
import { WordExportTool } from './tools/word-export.tool';
import { ReportAdvisorTool } from './tools/report-advisor.tool';

@Module({
  providers: [
    // ... existing
    ReportGeneratorService,
    PdfExportTool,
    WordExportTool,
    ReportAdvisorTool,
  ],
})
```

### Step 4: Register Tools (5 phút)

```typescript
// langchain-agent.service.ts
constructor(
  // ... existing
  private pdfExportTool: PdfExportTool,
  private wordExportTool: WordExportTool,
  private reportAdvisorTool: ReportAdvisorTool,
) {}

private getTools(): Tool[] {
  return [
    // ... existing
    this.pdfExportTool,
    this.wordExportTool,
    this.reportAdvisorTool,
  ];
}
```

### Step 5: Test (3 phút)

```bash
# Restart server
npm run start:client-api:dev

# Test qua UI hoặc API
curl -X POST http://localhost:3000/api/private/v1/ai/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "Tạo báo cáo PDF cho 10 học viên có điểm cao nhất"}'
```

---

## 💬 User Queries Examples

AI sẽ tự động hiểu và xử lý:

### ✅ Gợi ý tự động
```
User: "Tạo báo cáo 150 học viên"
AI:
  1. Query 150 students
  2. Report Advisor → Suggest Excel (confidence 0.9)
  3. Generate Excel
  4. "Báo cáo Excel đã sẵn sàng! [Download]"
```

### ✅ Chỉ định format
```
User: "Xuất báo cáo 20 khóa học ra PDF"
AI:
  1. Query 20 courses
  2. Generate PDF
  3. "Báo cáo PDF đã được tạo! [Download]"
```

### ✅ Báo cáo phức tạp
```
User: "Tạo báo cáo chi tiết về lớp ABC123 bao gồm điểm số và biểu đồ"
AI:
  1. Query classroom data
  2. Generate charts
  3. Report Advisor → Suggest Word (complex data)
  4. Generate Word with embedded charts
  5. "Báo cáo Word chi tiết đã sẵn sàng! [Download]"
```

---

## 🎨 Customization Tips

### Custom PDF Layout

```typescript
// pdf-export.tool.ts
const doc = new PDFDocument({
  size: 'A4',
  layout: 'landscape', // hoặc 'portrait'
  margins: {
    top: 50,
    bottom: 50,
    left: 70,
    right: 70,
  },
});

// Add logo
doc.image('path/to/logo.png', 50, 45, { width: 100 });

// Custom colors
doc.fillColor('#4472C4'); // Header color
doc.strokeColor('#cccccc'); // Border color
```

### Custom Word Styling

```typescript
// word-export.tool.ts
const doc = new Document({
  sections: [{
    properties: {
      page: {
        margin: {
          top: 1440, // 1 inch = 1440 twips
          right: 1440,
          bottom: 1440,
          left: 1440,
        },
      },
    },
    children: sections,
  }],
});
```

### Add Company Logo

```typescript
// report-generator.service.ts
const logoPath = join(process.cwd(), 'assets', 'logo.png');

// For PDF
doc.image(logoPath, 50, 45, { width: 100 });

// For Word
new Paragraph({
  children: [
    new ImageRun({
      data: fs.readFileSync(logoPath),
      transformation: { width: 100, height: 50 },
    }),
  ],
});
```

---

## 🐛 Troubleshooting

### Lỗi: "Cannot find module 'pdfkit'"
```bash
npm install pdfkit @types/pdfkit
```

### Lỗi: "Permission denied" khi tạo file
```bash
# Tạo thư mục upload
mkdir -p uploads/reports
chmod 755 uploads/reports
```

### Lỗi: File không download được
```typescript
// Kiểm tra endpoint trong controller
@Get('download/:filename')
// Và đảm bảo route được register đúng
```

### PDF hiển thị sai font tiếng Việt
```typescript
// Sử dụng font hỗ trợ Unicode
doc.font('Helvetica'); // OK
// Hoặc embed custom font
doc.registerFont('CustomFont', 'path/to/font.ttf');
```

---

## 📚 Advanced Features (Optional)

### 1. Email Reports

```typescript
import { MailerService } from '@nestjs-modules/mailer';

async emailReport(filename: string, recipient: string) {
  await this.mailerService.sendMail({
    to: recipient,
    subject: 'Báo cáo của bạn',
    text: 'Báo cáo đã được tạo',
    attachments: [{
      filename,
      path: join(this.uploadsDir, filename),
    }],
  });
}
```

### 2. Scheduled Reports

```typescript
import { Cron } from '@nestjs/schedule';

@Cron('0 0 * * 1') // Every Monday at midnight
async generateWeeklyReport() {
  const data = await this.queryWeeklyData();
  await this.generateReport(data, 'excel');
}
```

### 3. Report Templates

```typescript
const templates = {
  'student-performance': {
    title: 'Báo Cáo Kết Quả Học Tập',
    columns: ['Họ Tên', 'Lớp', 'Điểm TB', 'Xếp Loại'],
    logo: true,
    statistics: true,
  },
  'course-analytics': {
    title: 'Phân Tích Khóa Học',
    columns: ['Tên Khóa Học', 'Số HV', 'Tỷ Lệ HT', 'Đánh Giá'],
    logo: true,
    charts: true,
  },
};
```

---

## 📈 Monitoring

### Log Report Generation

```typescript
this.logger.log(`📊 Report generated: ${filename}`);
this.logger.log(`   Format: ${format}`);
this.logger.log(`   Records: ${data.length}`);
this.logger.log(`   Size: ${fileSize} KB`);
this.logger.log(`   Time: ${generationTime} ms`);
```

### Track Usage

```typescript
await this.prisma.reportLog.create({
  data: {
    userId,
    reportType: 'student-performance',
    format: 'pdf',
    recordCount: data.length,
    generatedAt: new Date(),
  },
});
```

---

## ✅ Checklist

- [ ] Dependencies installed (`pdfkit`, `docx`)
- [ ] `ReportGeneratorService` created
- [ ] `PdfExportTool` created
- [ ] `WordExportTool` created
- [ ] `ReportAdvisorTool` created
- [ ] Tools registered in `agent.module.ts`
- [ ] Tools added to LangChain agent
- [ ] Download endpoint added
- [ ] Tested with sample data
- [ ] Logo/branding added (optional)

---

## 🎯 Next Steps

1. **Test với dữ liệu thật**: Thử với các loại báo cáo khác nhau
2. **Customize templates**: Thêm logo, màu sắc công ty
3. **Add more report types**: Student performance, course analytics, etc.
4. **Optimize performance**: Cache templates, parallel generation
5. **Add monitoring**: Track usage, errors, generation time

---

**Need Help?**
- Chi tiết implementation: `RAG_REPORT_GENERATOR_IMPLEMENTATION.md`
- RAG overview: `RAG_SUMMARY_VI.md`
- Security: `RAG_SECURITY_FIXES.md`

**Estimated Time**: 30-60 phút cho basic implementation
**Complexity**: Medium ⭐⭐⭐☆☆


