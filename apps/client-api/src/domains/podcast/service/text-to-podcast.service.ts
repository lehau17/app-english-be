import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { UploadService } from '../../upload/upload.service';
import { PodcastService } from './podcast.service';

@Injectable()
export class TextToPodcastService {
  private readonly logger = new Logger(TextToPodcastService.name);
  private readonly uploadsPath = 'uploads/podcasts';

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly configService: ConfigService,
    private readonly podcastService: PodcastService,
    private readonly uploadService: UploadService,
  ) {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsPath)) {
      fs.mkdirSync(this.uploadsPath, { recursive: true });
    }
  }
}
