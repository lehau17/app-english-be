import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  EvaluatePronunciationDto,
  EvaluateSpeechDto,
  EvaluateWritingDto,
  EvaluationResultDto,
} from '../dto/evaluation.dto';
import { EvaluationService } from '../service/evaluation.service';

@ApiTags('AI Evaluation')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/ai-evaluation')
export class AiEvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post('pronunciation')
  @ApiOperation({ summary: 'Evaluate pronunciation recording using AI' })
  @ResponseMessage('Pronunciation evaluated successfully')
  evaluatePronunciation(
    @PayloadToken() payload: JwtPayload,
    @Body() dto: EvaluatePronunciationDto,
  ): Promise<EvaluationResultDto> {
    return this.evaluationService.evaluatePronunciation(payload.sub, dto);
  }

  @Post('speaking')
  @ApiOperation({ summary: 'Evaluate speaking task recording using AI' })
  @ResponseMessage('Speaking evaluated successfully')
  evaluateSpeaking(
    @PayloadToken() payload: JwtPayload,
    @Body() dto: EvaluateSpeechDto,
  ): Promise<EvaluationResultDto> {
    return this.evaluationService.evaluateSpeaking(payload.sub, dto);
  }

  @Post('writing')
  @ApiOperation({ summary: 'Evaluate writing submission using AI' })
  @ResponseMessage('Writing evaluated successfully')
  evaluateWriting(
    @PayloadToken() payload: JwtPayload,
    @Body() dto: EvaluateWritingDto,
  ): Promise<EvaluationResultDto> {
    return this.evaluationService.evaluateWriting(payload.sub, dto);
  }
}
