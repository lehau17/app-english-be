import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import { Tool } from 'langchain/tools';
import { join } from 'path';

@Injectable()
export class ExcelExportTool extends Tool {
  name = 'excel_export';
  description = `
Export data to Excel file (.xlsx).

Input should be a JSON string with:
{
  "filename": "ten_file", // Tên file (không cần .xlsx)
  "data": [ // Array of objects
    {"name": "Nguyen Van A", "score": 95},
    {"name": "Tran Thi B", "score": 90}
  ],
  "sheetName": "Sheet1", // Optional, default "Data"
  "title": "Danh sách học viên" // Optional, title for the sheet
}

Returns a JSON object with public download URL (no auth required):
{
  "success": true,
  "filename": "ten_file.xlsx",
  "downloadUrl": "/api/public/v1/ai/download/ten_file.xlsx",
  "message": "File Excel đã được tạo thành công"
}
`;

  private readonly logger = new Logger(ExcelExportTool.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'exports');

  constructor() {
    super();
    // Ensure uploads directory exists
    this.ensureUploadsDirExists();
  }

  private async ensureUploadsDirExists() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      this.logger.log(`📁 Exports directory ready: ${this.uploadsDir}`);
    } catch (error) {
      this.logger.error('Failed to create uploads directory:', error);
    }
  }

  async _call(input: string): Promise<string> {
    try {
      this.logger.log(`📊 Excel Export input: ${input}`);

      const parsedInput = JSON.parse(input);
      const {
        filename,
        data,
        sheetName = 'Data',
        title = 'Exported Data',
      } = parsedInput;

      // Validate data
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

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetName);

      // Add title row
      const titleRow = worksheet.addRow([title]);
      titleRow.font = { bold: true, size: 16 };
      titleRow.alignment = { horizontal: 'center' };
      worksheet.mergeCells(1, 1, 1, Object.keys(data[0]).length);

      // Add empty row
      worksheet.addRow([]);

      // Add headers (from first data object keys)
      const headers = Object.keys(data[0]);
      const headerRow = worksheet.addRow(headers);

      // Style headers
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Add data rows
      data.forEach((row) => {
        const values = headers.map((header) => row[header]);
        worksheet.addRow(values);
      });

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      });

      // Add borders to all cells
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > 2) {
          // Skip title and empty row
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
          });
        }
      });

      // Save file
      const timestamp = Date.now();
      const safeFilename = filename.replace(/[^a-z0-9_-]/gi, '_');
      const fullFilename = `${safeFilename}_${timestamp}.xlsx`;
      const filePath = join(this.uploadsDir, fullFilename);

      await workbook.xlsx.writeFile(filePath);

      this.logger.log(`✅ Excel file created: ${fullFilename}`);

      // Get API base URL from environment or use relative path
      const apiPort = process.env.CLIENT_API_PORT || '3000';
      const apiBaseUrl = `http://localhost:${apiPort}`;

      return JSON.stringify({
        success: true,
        filename: fullFilename,
        downloadUrl: `/api/public/v1/ai/download/${fullFilename}`,
        fullDownloadUrl: `${apiBaseUrl}/api/public/v1/ai/download/${fullFilename}`,
        message: `File Excel "${fullFilename}" đã được tạo thành công với ${data.length} bản ghi.`,
        recordCount: data.length,
      });
    } catch (error) {
      this.logger.error('❌ Excel export error:', error);
      return JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate Excel file',
      });
    }
  }
}
