import { Injectable, Logger } from '@nestjs/common';
import {
    AlignmentType,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
} from 'docx';
import { promises as fs } from 'fs';
import { Tool } from 'langchain/tools';
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
                        text: `• Tổng số bản ghi: ${data.length}`,
                    }),
                );

                sections.push(
                    new Paragraph({
                        text: `• Số trường: ${Object.keys(data[0]).length}`,
                        spacing: { after: 400 },
                    }),
                );
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
                error: (error as any).message || 'Failed to generate Word file',
            });
        }
    }
}


