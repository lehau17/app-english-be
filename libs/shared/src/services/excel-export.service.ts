import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ExcelColumn {
    header: string;
    key: string;
    width?: number;
}

@Injectable()
export class ExcelExportService {
    /**
     * Generate an Excel file with professional styling
     * @param data Array of data objects
     * @param columns Column definitions with headers and keys
     * @param title Optional title for the worksheet
     * @returns Buffer containing the Excel file
     */
    async generateExcel(
        data: Record<string, any>[],
        columns: ExcelColumn[],
        title?: string,
    ): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'English Learning CMS';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Data');

        // Add title row if provided
        let startRow = 1;
        if (title) {
            const titleRow = worksheet.addRow([title]);
            titleRow.font = { bold: true, size: 16, color: { argb: 'FF1F4E79' } };
            titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.mergeCells(1, 1, 1, columns.length);
            titleRow.height = 30;

            // Add empty row after title
            worksheet.addRow([]);
            startRow = 3;
        }

        // Set up columns
        worksheet.columns = columns.map((col) => ({
            header: col.header,
            key: col.key,
            width: col.width || 15,
        }));

        // If we had a title, we need to manually add header row
        if (title) {
            const headerRow = worksheet.addRow(columns.map((col) => col.header));
            this.styleHeaderRow(headerRow);
        } else {
            // Style the default header row (row 1)
            this.styleHeaderRow(worksheet.getRow(1));
        }

        // Add data rows
        const dataStartRow = title ? startRow + 1 : 2;
        data.forEach((item, index) => {
            const rowValues = columns.map((col) => {
                const value = item[col.key];
                // Format dates
                if (value instanceof Date) {
                    return this.formatDate(value);
                }
                // Format booleans to Vietnamese
                if (typeof value === 'boolean') {
                    return value ? 'Có' : 'Không';
                }
                return value ?? '';
            });

            const row = worksheet.addRow(rowValues);

            // Alternate row colors for readability
            if (index % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F2F2' },
                };
            }

            // Add borders to data cells
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                };
                cell.alignment = { vertical: 'middle' };
            });
        });

        // Auto-fit column widths (improve based on content)
        columns.forEach((col, index) => {
            const column = worksheet.getColumn(index + 1);
            let maxLength = col.header.length;

            column.eachCell({ includeEmpty: false }, (cell) => {
                const cellValue = cell.value?.toString() || '';
                if (cellValue.length > maxLength) {
                    maxLength = cellValue.length;
                }
            });

            column.width = Math.min(Math.max(maxLength + 2, col.width || 15), 50);
        });

        // Add footer with export info
        const footerRowNum = (title ? 4 : 2) + data.length;
        worksheet.addRow([]);
        const footerRow = worksheet.addRow([
            `Xuất dữ liệu: ${this.formatDate(new Date())} | Tổng số: ${data.length} bản ghi`,
        ]);
        footerRow.font = { italic: true, size: 10, color: { argb: 'FF888888' } };
        worksheet.mergeCells(footerRowNum + 1, 1, footerRowNum + 1, columns.length);

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    private styleHeaderRow(row: ExcelJS.Row): void {
        row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };
        row.alignment = { horizontal: 'center', vertical: 'middle' };
        row.height = 25;

        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF2F5496' } },
                left: { style: 'thin', color: { argb: 'FF2F5496' } },
                bottom: { style: 'thin', color: { argb: 'FF2F5496' } },
                right: { style: 'thin', color: { argb: 'FF2F5496' } },
            };
        });
    }

    private formatDate(date: Date): string {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    /**
     * Translate status values to Vietnamese
     */
    translateStatus(status: string): string {
        const statusMap: Record<string, string> = {
            active: 'Hoạt động',
            inactive: 'Không hoạt động',
            pending: 'Chờ xử lý',
            banned: 'Đã cấm',
            suspended: 'Tạm ngưng',
            male: 'Nam',
            female: 'Nữ',
            other: 'Khác',
            prefer_not_to_say: 'Không muốn nói',
            beginner: 'Cơ bản',
            elementary: 'Sơ cấp',
            intermediate: 'Trung cấp',
            upper_intermediate: 'Trung cao cấp',
            advanced: 'Nâng cao',
            expert: 'Chuyên gia',
        };
        return statusMap[status] || status || '';
    }
}
