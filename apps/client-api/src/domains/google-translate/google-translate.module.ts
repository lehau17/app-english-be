import { Module } from '@nestjs/common';
import { UploadModule } from '../upload';
import { UploadService } from '../upload/upload.service';
import { GoogleTranslateController } from './google-translate.controller';
import { GoogleTranslateFreeService, GoogleTranslateService } from './google-translate.service';

@Module({
  imports: [UploadModule],
  providers: [GoogleTranslateService, GoogleTranslateFreeService, UploadService],
  controllers: [GoogleTranslateController],
  exports: [GoogleTranslateService, GoogleTranslateFreeService],
})
export class GoogleTranslateModule {}
