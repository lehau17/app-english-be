import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { promises as fs } from 'fs';
import { join } from 'path';
import { z } from 'zod';

interface ChartConfig {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'doughnut';
  title: string;
  data: any[];
  config?: any;
}

@Injectable()
export class WordExportTool {
  private readonly logger = new Logger(WordExportTool.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'reports');

  constructor() {
    this.ensureUploadsDirExists();
  }

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'word_export',
      description: `Export data to Word document (.docx) with rich formatting. Supports embedding charts!
      
      Returns: JSON with "downloadUrl" (e.g. /api/public/v1/ai/download/filename.docx).`,
      schema: z.object({
        filename: z.string().describe('Ten file muon tao (khong can duoi .docx)'),
        title: z.string().describe('Tieu de bao cao'),
        description: z.string().optional().describe('Mo ta ngan gon'),
        data: z.array(z.record(z.any())).describe('Mang du lieu (array of objects)'),
        includeStatistics: z.boolean().optional().default(false).describe('Co them thong ke tong quan khong'),
        charts: z.array(z.object({
          type: z.enum(['chart']),
          chartType: z.enum(['bar', 'line', 'pie', 'area', 'doughnut']),
          title: z.string(),
          data: z.array(z.record(z.any()))
        })).optional().describe('Danh sach bieu do neu co'),
      }),
      func: async (input) => {
        return this.generateWord(input);
      },
    });
  }

  private async ensureUploadsDirExists() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create reports directory:', error);
    }
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

  async generateWord(input: {
    filename: string;
    data: any[];
    title: string;
    description?: string;
    includeStatistics?: boolean;
    charts?: any[];
  }): Promise<string> {
    try {
      this.logger.log(`Word Export input: ${JSON.stringify(input).substring(0, 200)}...`);

      const {
        filename,
        data,
        title = 'Report',
        description,
        includeStatistics = false,
        charts = [],
      } = input;

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
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
      );

      // Description
      if (description) {
        sections.push(
          new Paragraph({
            text: description,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
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
          alignment: AlignmentType.RIGHT,
          spacing: { after: 400 },
        }),
      );

      // Statistics
      if (includeStatistics) {
        sections.push(
          new Paragraph({
            text: 'Thống kê tổng quan',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          }),
        );

        sections.push(
          new Paragraph({
            text: `- Tổng số bản ghi: ${data.length}`,
          }),
        );

        sections.push(
          new Paragraph({
            text: `- Số trường: ${Object.keys(data[0]).length}`,
            spacing: { after: 400 },
          }),
        );
      }

      // Add charts if provided
      if (charts && charts.length > 0) {
        sections.push(
          new Paragraph({
            text: 'Biểu đồ',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          }),
        );

        for (const chart of charts) {
          try {
            const chartImageBuffer = await this.renderChartToImage(chart);
            if (chartImageBuffer) {
              // Add chart title
              sections.push(
                new Paragraph({
                  text: chart.title || 'Chart',
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 200, after: 100 },
                  children: [
                    new TextRun({
                      text: chart.title || 'Chart',
                      bold: true,
                      size: 24,
                    }),
                  ],
                }),
              );

              // Add chart image
              sections.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new ImageRun({
                      data: chartImageBuffer,
                      transformation: {
                        width: 500,
                        height: 300,
                      },
                      type: 'png',
                    }),
                  ],
                  spacing: { after: 400 },
                }),
              );
            }
          } catch (chartError) {
            this.logger.warn(`Failed to render chart: ${chartError}`);
          }
        }
      }

      // Table
      const headers = Object.keys(data[0]);

      const tableRows = [
        // Header row
        new TableRow({
          children: headers.map(
            (h) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: h, bold: true })],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
                shading: { fill: '4472C4' },
              }),
          ),
        }),
        // Data rows
        ...data.map(
          (row) =>
            new TableRow({
              children: headers.map(
                (h) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        text: String(row[h] ?? ''),
                      }),
                    ],
                  }),
              ),
            }),
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
            properties: {
              page: {
                margin: {
                  top: 1440,
                  right: 1440,
                  bottom: 1440,
                  left: 1440,
                },
              },
            },
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

      this.logger.log(`Word file created: ${fullFilename}`);

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
      this.logger.error('Word export error:', error);
      return JSON.stringify({
        success: false,
        error: (error as any).message || 'Failed to generate Word file',
      });
    }
  }
}
