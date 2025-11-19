import { ResponseMessage } from '@app/shared';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GenerateActivitiesDto } from '../dto/generate-activities.dto';
import { ActivityAIService } from '../service/activity-ai.service';

@ApiTags('Activity AI')
@Controller('private/v1/admin/activities')
export class ActivityAIController {
  constructor(private readonly activityAIService: ActivityAIService) {}

  @Post('ai-generate')
  @ApiOperation({ summary: 'Generate activities using AI' })
  @ApiResponse({
    status: 201,
    description: 'Activities generated successfully',
  })
  @ResponseMessage('Activities generated successfully')
  async generateActivities(@Body() dto: GenerateActivitiesDto) :Promise<any>{
    const activities = await this.activityAIService.generateActivities(
      dto.courseTitle,
      dto.courseDescription,
      dto.lessonTitle,
      dto.lessonDescription,
      dto.userPrompt,
      dto.count,
      dto.activityTypes,
      dto.difficulty,
    );

    return { activities };
  }
}
