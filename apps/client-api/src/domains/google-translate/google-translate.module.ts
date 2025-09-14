import { Module } from '@nestjs/common';
import { GoogleTranslateController } from './google-translate.controller';
import { GoogleTranslateFreeService, GoogleTranslateService } from './google-translate.service';

@Module({
  providers: [GoogleTranslateService, GoogleTranslateFreeService],
  controllers: [GoogleTranslateController],
  exports: [GoogleTranslateService, GoogleTranslateFreeService],
})
export class GoogleTranslateModule {}
