import {
  Controller
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Podcast Tests')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/podcast-tests')
export class PodcastTestController {

}
