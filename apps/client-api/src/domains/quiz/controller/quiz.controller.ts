import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FlashcardDto, QuizDto } from '../dto/quiz.dto';
import { QuizService } from '../service/quiz.service';

@ApiTags('Quizzes')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/quizzes')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('/generate')
  @ApiOperation({
    summary: "Generate a quiz from the user's vocabulary book",
  })
  @ApiQuery({
    name: 'questions',
    required: false,
    description: 'Number of questions to generate',
    example: 10,
  })
  @ResponseMessage('Quiz generated successfully.')
  async generateQuiz(
    @PayloadToken() user: JwtPayload,
    @Query('questions') numberOfQuestions?: string,
  ): Promise<QuizDto> {
    const limit = numberOfQuestions ? parseInt(numberOfQuestions, 10) : 10;
    return this.quizService.generateQuiz(user.sub, limit);
  }

  @Get('/flashcards')
  @ApiOperation({ summary: "Get all flashcards from the user's vocabulary" })
  @ResponseMessage('Flashcards fetched successfully.')
  async getFlashcards(
    @PayloadToken() user: JwtPayload,
  ): Promise<FlashcardDto[]> {
    return this.quizService.getFlashcards(user.sub);
  }
}
