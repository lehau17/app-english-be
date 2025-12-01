import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ReportGeneratorService } from '../service/report-generator.service';

@Injectable()
export class ReportAdvisorTool {
  private readonly logger = new Logger(ReportAdvisorTool.name);

  constructor(private reportGenerator: ReportGeneratorService) {}

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'report_advisor',
      description: `Phan tich du lieu va goi y format bao cao phu hop nhat (PDF, Word, Excel).

Returns:
{
  "suggestedFormat": "excel",
  "reason": "...",
  "confidence": 0.9,
  "alternatives": [
    {"format": "pdf", "reason": "...", "confidence": 0.7}
  ]
}`,
      schema: z.object({
        data: z.array(z.record(z.string(), z.unknown())).describe('Array of data objects to analyze'),
        context: z.string().optional().describe('Context of the report (e.g., student performance)'),
      }),
      func: async ({ data, context }) => {
        return this._call(JSON.stringify({ data, context }));
      },
    });
  }

  private async _call(input: string): Promise<string> {
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

      // Generate statistics
      const statistics = this.reportGenerator.generateStatistics(data);

      this.logger.log(
        `Report format suggested: ${suggestion.format} (confidence: ${suggestion.confidence})`,
      );

      return JSON.stringify({
        suggestedFormat: suggestion.format,
        reason: suggestion.reason,
        confidence: suggestion.confidence,
        alternatives,
        statistics: {
          recordCount: data.length,
          fieldCount: Object.keys(data[0] || {}).length,
          ...statistics,
        },
        context: context || 'general',
      });
    } catch (error) {
      this.logger.error('Report advisor error:', error);
      return JSON.stringify({
        error: (error as any).message || 'Failed to analyze data',
      });
    }
  }
}
