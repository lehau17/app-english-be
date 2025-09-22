import { Module } from '@nestjs/common';
import { UploadModule } from '../upload';
import { UploadService } from '../upload/upload.service';
import { GoogleTranslateController } from './google-translate.controller';
import {
  GoogleTranslateFreeService,
  GoogleTranslateService,
} from './google-translate.service';
import { VietnameseUtil } from './vietnamese.util';

@Module({
  imports: [UploadModule],
  providers: [
    GoogleTranslateService,
    GoogleTranslateFreeService,
    UploadService,
    VietnameseUtil,
  ],
  controllers: [GoogleTranslateController],
  exports: [GoogleTranslateService, GoogleTranslateFreeService, VietnameseUtil],
})
export class GoogleTranslateModule {}
