import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
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
}
