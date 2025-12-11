import { SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { MediaController } from './controller/media.controller';
import { MediaRepository } from './repository/media.repository';
import { MediaService } from './service/media.service';

@Module({
  imports: [SharedModule],
  controllers: [MediaController],
  providers: [MediaService, MediaRepository],
  exports: [MediaService, MediaRepository],
})
export class MediaModule {}
