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
  "data": [...],
  "context": "student performance"
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
