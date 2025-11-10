import { Injectable, Logger } from '@nestjs/common';
import { createWriteStream, promises as fs } from 'fs';
import { Tool } from 'langchain/tools';
import { join } from 'path';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfExportTool extends Tool {
  name = 'pdf_export';
  description = `
Export data to PDF file with professional layout.

Input should be a JSON string with:
{
  "filename": "ten_file",
  "data": [...],
  "title": "Báo cáo",
  "description": "Mô tả báo cáo",
  "includeStatistics": true,
  "pageOrientation": "portrait"
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
  private readonly fontsDir = join(process.cwd(), 'assets', 'fonts');

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

      await this.ensureUploadsDirExists();

      // Create PDF
      const doc = new PDFDocument({
        size: 'A4',
        layout: pageOrientation as any,
        margin: 50,
      });

      // Register Vietnamese-compatible fonts
      let fontRegular = 'Helvetica';
      let fontBold = 'Helvetica-Bold';

      try {
        const robotoRegular = join(this.fontsDir, 'Roboto-Regular.ttf');
        const robotoBold = join(this.fontsDir, 'Roboto-Bold.ttf');
        doc.registerFont('Roboto', robotoRegular);
        doc.registerFont('Roboto-Bold', robotoBold);
        fontRegular = 'Roboto';
        fontBold = 'Roboto-Bold';
        this.logger.log('✅ Fonts registered successfully');
      } catch (fontError) {
        this.logger.warn(
          '⚠️ Font registration failed, using default fonts:',
          fontError,
        );
        // Fallback to Helvetica if font files not found
      }

      const timestamp = Date.now();
      const safeFilename = filename.replace(/[^a-z0-9_-]/gi, '_');
      const fullFilename = `${safeFilename}_${timestamp}.pdf`;
      const filePath = join(this.uploadsDir, fullFilename);

      const stream = doc.pipe(createWriteStream(filePath));
      stream.on('error', (err) => {
        this.logger.error('❌ PDF stream error:', err);
      });

      // Add header
      doc.fontSize(20).font(fontBold).text(title, { align: 'center' });

      doc.moveDown();

      if (description) {
        doc
          .fontSize(12)
          .font(fontRegular)
          .text(description, { align: 'center' });
        doc.moveDown();
      }

      // Add generation date
      doc
        .fontSize(10)
        .font(fontRegular)
        .text(`Ngày tạo: ${new Date().toLocaleString('vi-VN')}`, {
          align: 'right',
        });

      doc.moveDown(2);

      // Add statistics if requested
      if (includeStatistics) {
        doc.fontSize(14).font(fontBold).text('Thống kê tổng quan');
        doc.moveDown();

        doc
          .fontSize(11)
          .font(fontRegular)
          .text(`Tổng số bản ghi: ${data.length}`);
        doc.text(`Số trường: ${Object.keys(data[0]).length}`);

        doc.moveDown(2);
      }

      // Add table header
      const headers = Object.keys(data[0]);
      const pageWidth = doc.page.width - 100;

      if (headers.length > 0) {
        const colWidth = Math.min(pageWidth / headers.length, 120);
        doc.fontSize(10).font(fontBold);
        let xPos = 50;
        headers.forEach((header) => {
          doc.text(String(header).substring(0, 15), xPos, doc.y, {
            width: colWidth,
            align: 'left',
            continued: false,
          });
          xPos += colWidth;
        });

        doc.moveDown();
        doc.strokeColor('#000000').lineWidth(1);
        doc
          .moveTo(50, doc.y)
          .lineTo(doc.page.width - 50, doc.y)
          .stroke();
        doc.moveDown();
      }

      // Add table rows
      if (headers.length > 0) {
        const colWidth = Math.min(pageWidth / headers.length, 120);
        doc.fontSize(9).font(fontRegular);
        data.forEach((row, idx) => {
          if (doc.y > doc.page.height - 100) {
            doc.addPage();
            doc.y = 50;
          }

          const rowY = doc.y;
          let xPos = 50;
          headers.forEach((header) => {
            const rawValue = row[header];
            const value =
              rawValue === null || rawValue === undefined
                ? ''
                : typeof rawValue === 'object'
                  ? JSON.stringify(rawValue)
                  : String(rawValue);
            doc.text(value.substring(0, 80), xPos, rowY, {
              width: colWidth,
              align: 'left',
              continued: false,
            });
            xPos += colWidth;
          });

          doc.moveDown(0.5);

          // Add separator line every 5 rows
          if ((idx + 1) % 5 === 0) {
            doc.strokeColor('#cccccc').lineWidth(0.5);
            doc
              .moveTo(50, doc.y)
              .lineTo(doc.page.width - 50, doc.y)
              .stroke();
            doc.moveDown(0.5);
          }
        });
      } else {
        doc
          .fontSize(12)
          .font(fontRegular)
          .text('Không có dữ liệu dạng bảng để hiển thị.', {
            align: 'center',
          });
      }

      // Add footer
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .font(fontRegular)
          .text(`Trang ${i + 1} / ${range.count}`, 50, doc.page.height - 50, {
            align: 'center',
          });
      }

      // Finalize PDF
      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', (err) => reject(err));
      });

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
        error: (error as any).message || 'Failed to generate PDF file',
      });
    }
  }
}
