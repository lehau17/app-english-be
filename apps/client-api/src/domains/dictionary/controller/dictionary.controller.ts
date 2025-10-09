import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import {
  Controller,
  Get,
  Param,
  Query
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { WordResultDto } from '../dto/dictionary.dto';
import { DictionaryService } from '../service/dictionary.service';

@ApiTags('Dictionary')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/dictionary')
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get('/lookup/:word')
  @ApiOperation({
    summary: 'Lookup word definition',
    description: 'Get detailed information about a word including definitions, pronunciation, synonyms, etc.',
  })
  @ApiParam({ name: 'word', example: 'example' })
  @ResponseMessage('Word details fetched successfully')
  async lookupWord(
    @Param('word') word: string,
    @PayloadToken() user: JwtPayload,
  ): Promise<WordResultDto> {
    // Track user search
    await this.dictionaryService.addRecentSearch(user.sub, word);

    return this.dictionaryService.lookupWord(word);
  }

  @Get('/suggestions')
  @ApiOperation({
    summary: 'Get word suggestions for autocomplete',
    description: 'Returns a list of words matching the query prefix',
  })
  @ApiQuery({ name: 'q', example: 'exam', description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ResponseMessage('Suggestions fetched successfully')
  async getSuggestions(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ): Promise<{ suggestions: string[] }> {
    const suggestions = await this.dictionaryService.getSuggestions(
      query,
      limit ? parseInt(String(limit)) : 10,
    );
    return { suggestions };
  }

  @Get('/rhymes/:word')
  @ApiOperation({
    summary: 'Get rhyming words',
    description: 'Find words that rhyme with the given word',
  })
  @ApiParam({ name: 'word', example: 'cat' })
  @ResponseMessage('Rhymes fetched successfully')
  async getRhymes(@Param('word') word: string): Promise<{ rhymes: string[] }> {
    const rhymes = await this.dictionaryService.getRhymes(word);
    return { rhymes };
  }

  @Get('/recent')
  @ApiOperation({
    summary: 'Get recent searches',
    description: 'Returns user\'s recent word searches',
  })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ResponseMessage('Recent searches fetched successfully')
  async getRecentSearches(
    @PayloadToken() user: JwtPayload,
    @Query('limit') limit?: number,
  ): Promise<{ words: string[] }> {
    const words = await this.dictionaryService.getRecentSearches(
      user.sub,
      limit ? parseInt(String(limit)) : 10,
    );
    return { words };
  }
}
