import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SavedWord } from '@prisma/client';
import { SaveWordDto } from '../dto/vocabulary.dto';
import { VocabularyService } from '../service/vocabulary.service';

@ApiTags('Vocabulary')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/vocabulary')
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Post()
  @ApiOperation({ summary: 'Save a word to personal vocabulary book' })
  @ResponseMessage('Word saved successfully.')
  async saveWord(
    @PayloadToken() user: JwtPayload,
    @Body() body: SaveWordDto,
  ): Promise<SavedWord> {
    return this.vocabularyService.saveWord(user.sub, body.word);
  }

  @Get()
  @ApiOperation({ summary: 'Get all saved words' })
  @ResponseMessage('Saved words fetched successfully.')
  async getSavedWords(@PayloadToken() user: JwtPayload): Promise<SavedWord[]> {
    return this.vocabularyService.getSavedWords(user.sub);
  }

  @Delete(':word')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a word from vocabulary book' })
  @ResponseMessage('Word deleted successfully.')
  async deleteWord(
    @PayloadToken() user: JwtPayload,
    @Param('word') word: string,
  ): Promise<void> {
    return this.vocabularyService.deleteWord(user.sub, word);
  }
}