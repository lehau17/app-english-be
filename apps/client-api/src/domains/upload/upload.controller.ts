import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';

@ApiTags('Upload')
@Controller('/public/v1/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded',
    schema: { example: { url: 'https://...' } },
  })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const url = await this.uploadService.uploadFile(file);
    return { url };
  }

  @Get('test-s3-connection')
  @ApiOperation({ summary: 'Test S3/MinIO connection' })
  @ApiResponse({
    status: 200,
    description: 'S3 connection test result',
    schema: {
      example: {
        success: true,
        endpoint: 'http://localhost:9000',
        bucket: 'english-learning',
        message: 'S3 connection OK',
      },
    },
  })
  async testS3Connection() {
    return await this.uploadService.testConnection();
  }
}
