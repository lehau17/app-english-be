import { Tool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ChartGeneratorTool extends Tool {
  name = 'chart_generator';
  description = `
Generate interactive charts/visualizations from data.
Input should be a JSON object with:
- chartType: "bar" | "line" | "pie" | "area" | "scatter" | "radar"
- data: array of data points (e.g., [{name: "Students", value: 120}, {name: "Parents", value: 85}])
- title: chart title
- xLabel: x-axis label (optional)
- yLabel: y-axis label (optional)
- colors: array of colors (optional)

Example input:
{
  "chartType": "bar",
  "title": "Students vs Parents",
  "data": [{"name": "Students", "value": 120}, {"name": "Parents", "value": 85}],
  "xLabel": "Category",
  "yLabel": "Count"
}

Returns a JSON object with chart configuration for Recharts rendering.
`;

  private readonly logger = new Logger(ChartGeneratorTool.name);

  async _call(input: string): Promise<string> {
    try {
      this.logger.log(`Chart Generator input: ${input}`);

      const parsedInput = JSON.parse(input);
      const {
        chartType = 'bar',
        data = [],
        title = 'Chart',
        xLabel,
        yLabel,
        colors = [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#ec4899',
        ],
      } = parsedInput;

      // Validate data
      if (!Array.isArray(data) || data.length === 0) {
        return JSON.stringify({
          error: 'Invalid data: must be a non-empty array',
        });
      }

      // Generate chart config
      const chartConfig = {
        type: 'chart',
        chartType,
        title,
        data,
        config: {
          xLabel,
          yLabel,
          colors,
          responsive: true,
          legend: true,
        },
      };

      this.logger.log(
        `Chart config generated: ${JSON.stringify(chartConfig)}`,
      );

      return JSON.stringify({
        success: true,
        chart: chartConfig,
        message: `Generated ${chartType} chart with ${data.length} data points`,
      });
    } catch (error) {
      this.logger.error('Chart generation error:', error);
      return JSON.stringify({
        error: error.message || 'Failed to generate chart',
      });
    }
  }
}
