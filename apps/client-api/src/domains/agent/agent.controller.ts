import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Res,
  StreamableFile,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { join } from 'path';
import { AddDocumentDto, QueryDto } from './dto/query.dto';
import { LangChainAgentService } from './service/langchain-agent.service';
import { RagService } from './service/rag.service';

// 👉 SWAGGER IMPORTS
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
// Nếu bạn đã tạo response DTO ở bước (3)

@ApiTags('AI') // gom các endpoint này vào tag "AI" trong Swagger
@Controller('/public/v1/ai')
export class IntelligentController {
  private readonly logger = new Logger(IntelligentController.name);

  constructor(
    private langchainAgent: LangChainAgentService,
    private ragService: RagService,
  ) {}

  @Post('query')
  @UsePipes(new ValidationPipe())
  @ApiOperation({
    summary: 'Hỏi AI Agent',
    description:
      'Router tự động: Knowledge (RAG) / Database (SQL tool) / LLM. Trả về câu trả lời + bước thực thi.',
  })
  @ApiBody({
    type: QueryDto,
    examples: {
      rag: {
        value: { question: 'Điều kiện để được xếp loại tốt nghiệp xuất sắc?' },
      },
      sql: { value: { question: 'Top 5 học sinh có GPA cao nhất lớp 12A1' } },
      hybrid: {
        value: { question: 'Trong 12A1, ai đủ điều kiện tốt nghiệp xuất sắc?' },
      },
    },
  })
  async query(@Body() queryDto: QueryDto) {
    this.logger.log(`📥 Nhận câu hỏi: ${queryDto.question}`);
    const result = await this.langchainAgent.processUserQuery(
      queryDto.question,
    );
    return result;
  }

  @Post('documents')
  @UsePipes(new ValidationPipe())
  @ApiOperation({
    summary: 'Thêm tài liệu vào Knowledge Base',
    description:
      'Sinh embedding và lưu tài liệu để RAG có thể truy xuất sau này.',
  })
  @ApiBody({
    type: AddDocumentDto,
    examples: {
      default: {
        value: {
          title: 'Quy định học bổng',
          content: 'Điều kiện nhận học bổng: GPA ≥ 8.0...',
          documentType: 'regulation',
          source: 'Phòng CTSV',
        },
      },
    },
  })
  async addDocument(@Body() addDocumentDto: AddDocumentDto) {
    this.logger.log(`📄 Thêm tài liệu: ${addDocumentDto.title}`);
    const document = await this.ragService.addDocument(addDocumentDto);
    return document;
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({
    description: 'Tình trạng các service',
    schema: {
      example: {
        status: 'OK',
        services: {
          langchainAgent: 'running',
          ragService: 'running',
          sqlService: 'running',
          geminiService: 'running',
        },
        timestamp: '2025-08-31T10:20:30.000Z',
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async healthCheck() {
    return {
      status: 'OK',
      services: {
        langchainAgent: 'running',
        ragService: 'running',
        sqlService: 'running',
        geminiService: 'running',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('download/:filename')
  @ApiOperation({
    summary: 'Download exported Excel file (Public)',
    description: 'Public endpoint to download Excel files without authentication. Files are temporary and auto-generated.'
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
  })
  async downloadFile(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    this.logger.log(`📥 Public download request: ${filename}`);

    const uploadsDir = join(process.cwd(), 'uploads', 'exports');
    const filePath = join(uploadsDir, filename);

    // Set response headers
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    const file = createReadStream(filePath);
    return new StreamableFile(file);
  }
}
