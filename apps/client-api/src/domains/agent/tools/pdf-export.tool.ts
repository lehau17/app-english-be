import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createWriteStream, promises as fs } from 'fs';
import { Tool } from 'langchain/tools';
import { join } from 'path';
// Use require for CommonJS module pdfkit (pdfkit doesn't have default export)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

interface ChartConfig {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'doughnut';
  title: string;
  data: any[];
  config?: any;
}

// Font URLs from Google Fonts CDN (Roboto supports Vietnamese)
const FONT_URLS = {
  regular:
    'https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Regular.ttf',
  bold: 'https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf',
};

@Injectable()
export class PdfExportTool extends Tool {
  name = 'pdf_export';
  description = `
Export data to PDF file with professional layout. Supports embedding charts!

Input should be a JSON string with:
{
  "filename": "ten_file",
  "data": [...],
  "title": "Báo cáo",
  "description": "Mô tả báo cáo",
  "includeStatistics": true,
  "pageOrientation": "portrait",
  "charts": [
    {
      "type": "chart",
      "chartType": "bar",
      "title": "Biểu đồ doanh thu",
      "data": [{"name": "Q1", "value": 100}, {"name": "Q2", "value": 200}]
    }
  ]
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
  private readonly fontsDir = join(process.cwd(), 'uploads', 'fonts');
  private fontsLoaded = false;

  constructor() {
    super();
    this.ensureUploadsDirExists();
    this.downloadFonts();
  }

  private async ensureUploadsDirExists() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      await fs.mkdir(this.fontsDir, { recursive: true });
      this.logger.log(`Reports directory ready: ${this.uploadsDir}`);
    } catch (error) {
      this.logger.error('Failed to create directories:', error);
    }
  }

  /**
   * Download Unicode fonts if not exists
   */
  private async downloadFonts() {
    try {
      const regularPath = join(this.fontsDir, 'Roboto-Regular.ttf');
      const boldPath = join(this.fontsDir, 'Roboto-Bold.ttf');

      // Check if fonts already exist
      try {
        await fs.access(regularPath);
        await fs.access(boldPath);
        this.fontsLoaded = true;
        this.logger.log('Unicode fonts already available');
        return;
      } catch {
        // Fonts don't exist, download them
      }

      this.logger.log('Downloading Unicode fonts...');

      // Download regular font
      const regularResponse = await axios.get(FONT_URLS.regular, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      await fs.writeFile(regularPath, Buffer.from(regularResponse.data));

      // Download bold font
      const boldResponse = await axios.get(FONT_URLS.bold, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      await fs.writeFile(boldPath, Buffer.from(boldResponse.data));

      this.fontsLoaded = true;
      this.logger.log('Unicode fonts downloaded successfully');
    } catch (error) {
      this.logger.warn('Failed to download fonts, will use fallback:', error);
      this.fontsLoaded = false;
    }
  }

  /**
   * Get font paths (Unicode or fallback)
   */
  private async getFonts(): Promise<{ regular: string; bold: string }> {
    if (this.fontsLoaded) {
      return {
        regular: join(this.fontsDir, 'Roboto-Regular.ttf'),
        bold: join(this.fontsDir, 'Roboto-Bold.ttf'),
      };
    }
    // Fallback to built-in fonts (no Vietnamese support)
    return {
      regular: 'Helvetica',
      bold: 'Helvetica-Bold',
    };
  }

  /**
   * Render chart to image using QuickChart.io API
   */
  private async renderChartToImage(chart: ChartConfig): Promise<Buffer | null> {
    try {
      // Convert our chart format to Chart.js format for QuickChart
      const chartJsConfig = this.convertToChartJs(chart);

      const response = await axios.post(
        'https://quickchart.io/chart',
        {
          chart: chartJsConfig,
          width: 600,
          height: 400,
          backgroundColor: 'white',
          format: 'png',
        },
        {
          responseType: 'arraybuffer',
          timeout: 10000,
        },
      );

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error('Failed to render chart to image:', error);
      return null;
    }
  }

  /**
   * Convert our chart format to Chart.js format
   */
  private convertToChartJs(chart: ChartConfig): any {
    const { chartType, data, title } = chart;

    // Extract labels and values from data
    const labels = data.map((d) => d.name || d.label || '');

    // Get all numeric keys for datasets
    const numericKeys = Object.keys(data[0] || {}).filter(
      (key) =>
        key !== 'name' && key !== 'label' && typeof data[0][key] === 'number',
    );

    const colors = [
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
    ];

    // Map chart types
    const chartTypeMap: Record<string, string> = {
      bar: 'bar',
      line: 'line',
      pie: 'pie',
      area: 'line',
      doughnut: 'doughnut',
    };

    const type = chartTypeMap[chartType] || 'bar';

    if (type === 'pie' || type === 'doughnut') {
      // Pie/Doughnut chart
      const values = data.map(
        (d) => d.value || d.Doanh_thu || d['Doanh thu'] || 0,
      );
      return {
        type,
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: colors.slice(0, data.length),
            },
          ],
        },
        options: {
          plugins: {
            title: { display: true, text: title },
            legend: { display: true, position: 'bottom' },
          },
        },
      };
    }

    // Bar/Line/Area chart
    const datasets = numericKeys.map((key, index) => ({
      label: key,
      data: data.map((d) => d[key] || 0),
      backgroundColor:
        chartType === 'area'
          ? `${colors[index % colors.length]}80`
          : colors[index % colors.length],
      borderColor: colors[index % colors.length],
      fill: chartType === 'area',
      tension: chartType === 'line' || chartType === 'area' ? 0.4 : 0,
    }));

    return {
      type,
      data: {
        labels,
        datasets,
      },
      options: {
        plugins: {
          title: { display: true, text: title },
          legend: { display: true, position: 'bottom' },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    };
  }

  async _call(input: string): Promise<string> {
    try {
      this.logger.log(`PDF Export input: ${input.substring(0, 200)}...`);

      const parsedInput = JSON.parse(input);
      const {
        filename,
        data,
        title = 'Report',
        description,
        includeStatistics = false,
        pageOrientation = 'portrait',
        charts = [],
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

      // Create PDF with buffered pages for page numbering
      const doc = new PDFDocument({
        size: 'A4',
        layout: pageOrientation as any,
        margin: 50,
        bufferPages: true, // Enable page buffering for footer
      });

      // Get Unicode fonts (Roboto supports Vietnamese)
      const fonts = await this.getFonts();
      const fontRegular = fonts.regular;
      const fontBold = fonts.bold;

      // Register fonts if using custom TTF files
      if (fontRegular.endsWith('.ttf')) {
        doc.registerFont('Regular', fontRegular);
        doc.registerFont('Bold', fontBold);
      }

      const fontNameRegular = fontRegular.endsWith('.ttf')
        ? 'Regular'
        : fontRegular;
      const fontNameBold = fontBold.endsWith('.ttf') ? 'Bold' : fontBold;

      const timestamp = Date.now();
      const safeFilename = filename.replace(/[^a-z0-9_-]/gi, '_');
      const fullFilename = `${safeFilename}_${timestamp}.pdf`;
      const filePath = join(this.uploadsDir, fullFilename);

      const stream = doc.pipe(createWriteStream(filePath));
      stream.on('error', (err) => {
        this.logger.error('PDF stream error:', err);
      });

      // Add header
      doc.fontSize(20).font(fontNameBold).text(title, { align: 'center' });

      doc.moveDown();

      if (description) {
        doc
          .fontSize(12)
          .font(fontNameRegular)
          .text(description, { align: 'center' });
        doc.moveDown();
      }

      // Add generation date
      doc
        .fontSize(10)
        .font(fontNameRegular)
        .text(`Ngày tạo: ${new Date().toLocaleString('vi-VN')}`, {
          align: 'right',
        });

      doc.moveDown(2);

      // Add statistics if requested
      if (includeStatistics) {
        doc.fontSize(14).font(fontNameBold).text('Thống kê tổng quan');
        doc.moveDown();

        doc
          .fontSize(11)
          .font(fontNameRegular)
          .text(`Tổng số bản ghi: ${data.length}`);
        doc.text(`Số trường: ${Object.keys(data[0]).length}`);

        doc.moveDown(2);
      }

      // Add charts if provided
      if (charts && charts.length > 0) {
        doc.fontSize(14).font(fontNameBold).text('Biểu đồ');
        doc.moveDown();

        for (const chart of charts) {
          try {
            const chartImageBuffer = await this.renderChartToImage(chart);
            if (chartImageBuffer) {
              // Check if need new page
              if (doc.y > doc.page.height - 300) {
                doc.addPage();
              }

              // Add chart title
              doc
                .fontSize(12)
                .font(fontNameBold)
                .text(chart.title || 'Chart', { align: 'center' });
              doc.moveDown(0.5);

              // Add chart image
              doc.image(chartImageBuffer, {
                fit: [450, 250],
                align: 'center',
              });
              doc.moveDown(2);
            }
          } catch (chartError) {
            this.logger.warn(`Failed to render chart: ${chartError}`);
          }
        }
      }

      // Add table header
      const headers = Object.keys(data[0]);
      const pageWidth = doc.page.width - 100;

      if (headers.length > 0) {
        const colWidth = Math.min(pageWidth / headers.length, 120);
        doc.fontSize(10).font(fontNameBold);
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
        doc.fontSize(9).font(fontNameRegular);
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
          .font(fontNameRegular)
          .text('Không có dữ liệu dạng bảng để hiển thị.', {
            align: 'center',
          });
      }

      // Add page numbers to all pages (bufferPages must be true)
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);

        // Save current position
        const oldY = doc.y;

        // Add page number at bottom
        doc
          .fontSize(8)
          .font(fontNameRegular)
          .text(`Trang ${i + 1} / ${totalPages}`, 50, doc.page.height - 40, {
            align: 'center',
            width: doc.page.width - 100,
          });

        // Restore position (not needed since we're done)
      }

      // Finalize PDF
      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', (err) => reject(err));
      });

      this.logger.log(`PDF file created: ${fullFilename}`);

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
      this.logger.error('PDF export error:', error);
      return JSON.stringify({
        success: false,
        error: (error as any).message || 'Failed to generate PDF file',
      });
    }
  }
}
